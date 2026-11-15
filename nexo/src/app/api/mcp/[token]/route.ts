import { mcpGet, mcpPost } from "@/services/mcp/server";

/** Conector MCP com a chave no endereço (para clientes que não aceitam cabeçalho, ex.: ChatGPT). */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return mcpPost(req, token);
}
export const GET = mcpGet;
export async function DELETE() { return new Response(null, { status: 204 }); }
