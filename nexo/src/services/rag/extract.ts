import "server-only";

const TEXT_EXT = /\.(txt|md|mdx|csv|json|ya?ml|xml|html?|sql|py|ts|tsx|js|jsx|java|cs|go|rb|php|sh|ps1|kt|swift|rs|c|cpp|h|css|scss|tf|bicep|ipynb|env\.example)$/i;

export class ExtractionError extends Error {}

/** Extrai texto puro de um arquivo. Imagens exigem descrição textual no MVP. */
export async function extractText(file: { name: string; mime: string; bytes: Uint8Array }): Promise<string> {
  const { name, mime, bytes } = file;
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) {
    const { extractText: pdf, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(bytes);
    const { text } = await pdf(doc, { mergePages: false });
    return (Array.isArray(text) ? text : [text]).map((t, i) => `[Página ${i + 1}]\n${t}`).join("\n\n");
  }
  if (/\.docx$/i.test(name) || mime.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return value;
  }
  if (mime.startsWith("text/") || TEXT_EXT.test(name) || mime === "application/json") {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    if (/\.html?$/i.test(name) || mime === "text/html") return htmlToText(raw);
    if (/\.(py|ts|tsx|js|jsx|java|cs|go|rb|php|sh|kt|swift|rs|c|cpp|h|sql|tf|bicep)$/i.test(name))
      return `Arquivo de código: ${name}\n\n${raw}`;
    return raw;
  }
  if (mime.startsWith("image/"))
    throw new ExtractionError("Imagens precisam de uma descrição em texto (campo 'Conteúdo') para serem indexadas.");
  throw new ExtractionError(`Formato não suportado: ${name}`);
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n")
    .replace(/<h([1-4])[^>]*>/gi, (_m, n) => "\n" + "#".repeat(Number(n)) + " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*/g, "\n\n")
    .trim();
}

/** Baixa uma URL pública com proteções contra SSRF básicas. */
export async function fetchUrlText(url: string): Promise<string> {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new ExtractionError("Somente URLs http(s).");
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/.test(host))
    throw new ExtractionError("Endereços internos não são permitidos.");
  const res = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "user-agent": "Nexo/1.0" } });
  if (!res.ok) throw new ExtractionError(`Falha ao baixar a URL (${res.status}).`);
  const type = res.headers.get("content-type") ?? "";
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.byteLength > 5 * 1024 * 1024) throw new ExtractionError("Página maior que 5 MB.");
  if (type.includes("pdf")) return extractText({ name: "page.pdf", mime: "application/pdf", bytes: buf });
  const text = new TextDecoder().decode(buf);
  return type.includes("html") ? htmlToText(text) : text;
}
