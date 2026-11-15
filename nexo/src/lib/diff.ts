/** Diferença linha a linha (LCS) entre duas versões de texto. Sem dependências. */
export type DiffLine = { kind: "same" | "add" | "del"; text: string };

export function diffLines(oldText: string, newText: string, maxLines = 3000): DiffLine[] {
  const a = oldText ? oldText.split(/\r?\n/).slice(0, maxLines) : [];
  const b = newText ? newText.split(/\r?\n/).slice(0, maxLines) : [];
  const n = a.length, m = b.length;
  // tabela LCS compacta (n+1)x(m+1)
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ kind: "same", text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ kind: "del", text: a[i] }); i++; }
    else { out.push({ kind: "add", text: b[j] }); j++; }
  }
  while (i < n) out.push({ kind: "del", text: a[i++] });
  while (j < m) out.push({ kind: "add", text: b[j++] });
  return out;
}

export function diffStats(d: DiffLine[]) {
  return { added: d.filter((x) => x.kind === "add").length, removed: d.filter((x) => x.kind === "del").length };
}
