import { mcpGet, mcpPost, tokenFromHeaders } from "@/services/mcp/server";

/** Conector MCP com a chave no cabeçalho Authorization: Bearer <chave> (endereço sem segredo). */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) { return mcpPost(req, tokenFromHeaders(req)); }
export const GET = mcpGet;
export async function DELETE() { return new Response(null, { status: 204 }); }
