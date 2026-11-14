import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAI } from "@/services/ai/provider";
import { chunkText } from "./chunk";
import { extractText, fetchUrlText, ExtractionError } from "./extract";

const MAX_CHUNKS = 400;

export type IndexResult = { ok: true; chunks: number } | { ok: false; error: string };

/**
 * Indexa uma fonte. A permissão é validada com o cliente do usuário (RLS);
 * só depois o cliente admin grava chunks e embeddings.
 */
export async function indexSource(userClient: SupabaseClient, sourceId: string): Promise<IndexResult> {
  const { data: source, error } = await userClient
    .from("knowledge_sources")
    .select("id, project_id, name, source_type, category, storage_path, source_url, raw_text")
    .eq("id", sourceId)
    .single();
  if (error || !source) return { ok: false, error: "Fonte não encontrada ou sem permissão." };

  const { data: canWrite } = await userClient.rpc("can_write_project", { p_project: source.project_id });
  if (!canWrite) return { ok: false, error: "Sem permissão para indexar neste projeto." };

  const admin = createAdminClient();
  await admin.from("knowledge_sources").update({ status: "processing", error_message: null }).eq("id", sourceId);

  try {
    let text = "";
    if (source.storage_path) {
      const { data: blob, error: dlErr } = await admin.storage.from("knowledge").download(source.storage_path);
      if (dlErr || !blob) throw new ExtractionError("Arquivo não encontrado no storage.");
      text = await extractText({
        name: source.storage_path.split("/").pop() ?? source.name,
        mime: blob.type || "application/octet-stream",
        bytes: new Uint8Array(await blob.arrayBuffer()),
      });
      if (source.raw_text) text = `${source.raw_text}\n\n${text}`;
    } else if (source.source_url) {
      text = await fetchUrlText(source.source_url);
      if (source.raw_text) text = `${source.raw_text}\n\n${text}`;
    } else {
      text = source.raw_text ?? "";
    }

    const header = `Fonte: ${source.name} | Tipo: ${source.source_type} | Categoria: ${source.category}`;
    const chunks = chunkText(text).slice(0, MAX_CHUNKS);
    if (chunks.length === 0) throw new ExtractionError("Nenhum texto encontrado na fonte.");

    const embeddings = await getAI().embed(chunks.map((c) => `${header}\n\n${c.content}`));

    await admin.from("document_chunks").delete().eq("source_id", sourceId);
    const rows = chunks.map((c, i) => ({
      source_id: sourceId,
      project_id: source.project_id,
      content: c.content,
      chunk_index: c.index,
      token_count: c.tokenCount,
      metadata: { ...c.metadata, source_name: source.name, category: source.category },
      embedding: JSON.stringify(embeddings[i]),
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error: insErr } = await admin.from("document_chunks").insert(rows.slice(i, i + 100));
      if (insErr) throw new Error(insErr.message);
    }
    await admin.from("knowledge_sources")
      .update({ status: "indexed", chunk_count: rows.length, error_message: null })
      .eq("id", sourceId);
    return { ok: true, chunks: rows.length };
  } catch (e) {
    const message = e instanceof ExtractionError ? e.message : "Falha na indexação. Tente reprocessar.";
    console.error("[indexSource]", sourceId, e);
    await admin.from("knowledge_sources").update({ status: "error", error_message: message }).eq("id", sourceId);
    return { ok: false, error: message };
  }
}
