import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines, diffStats } from "../src/lib/diff.ts";

test("diff mostra linhas adicionadas e removidas", () => {
  const d = diffLines("a\nb\nc", "a\nB\nc\nd");
  assert.deepEqual(d.map((x) => `${x.kind}:${x.text}`), ["same:a", "del:b", "add:B", "same:c", "add:d"]);
  assert.deepEqual(diffStats(d), { added: 2, removed: 1 });
});

test("primeira versão: tudo adicionado", () => {
  assert.deepEqual(diffStats(diffLines("", "x\ny")), { added: 2, removed: 0 });
});
