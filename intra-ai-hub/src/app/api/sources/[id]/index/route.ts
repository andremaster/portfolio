import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { indexSource } from "@/services/rag/indexer";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  const result = await indexSource(supabase, id);
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
