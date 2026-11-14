export type Chunk = { content: string; index: number; tokenCount: number; metadata: Record<string, unknown> };

/** Estimativa barata de tokens (~4 caracteres por token). */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);

/**
 * Divide o texto em blocos de ~maxChars respeitando parágrafos e linhas,
 * com sobreposição para não perder contexto entre blocos.
 */
export function chunkText(text: string, opts: { maxChars?: number; overlap?: number; heading?: boolean } = {}): Chunk[] {
  const maxChars = opts.maxChars ?? 1800;
  const overlap = opts.overlap ?? 200;
  const clean = text.replace(/\r\n/g, "\n").replace(/\u0000/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!clean) return [];

  const parts = clean.split(/\n\n/);
  const pieces: string[] = [];
  for (const p of parts) {
    if (p.length <= maxChars) { pieces.push(p); continue; }
    // parágrafo gigante: quebra por linha e depois por tamanho
    let buf = "";
    for (const line of p.split("\n")) {
      for (let i = 0; i < line.length; i += maxChars) {
        const seg = line.slice(i, i + maxChars);
        if ((buf + "\n" + seg).length > maxChars && buf) { pieces.push(buf); buf = ""; }
        buf = buf ? buf + "\n" + seg : seg;
      }
    }
    if (buf) pieces.push(buf);
  }

  const chunks: Chunk[] = [];
  let current = "";
  let heading = "";
  let dirty = false;
  const flush = () => {
    dirty = false;
    const content = current.trim();
    if (!content) return;
    chunks.push({ content, index: chunks.length, tokenCount: estimateTokens(content), metadata: heading ? { heading } : {} });
    current = content.length > overlap ? content.slice(-overlap) : "";
  };
  for (const piece of pieces) {
    const h = piece.match(/^#{1,4}\s+(.+)/);
    if (h) heading = h[1].slice(0, 120);
    if (current && (current.length + piece.length + 2) > maxChars) flush();
    current = current ? current + "\n\n" + piece : piece;
    dirty = true;
  }
  if (dirty) flush();
  return chunks;
}
