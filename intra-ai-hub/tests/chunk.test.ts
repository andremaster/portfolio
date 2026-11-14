import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkText } from "../src/services/rag/chunk.ts";

test("texto vazio não gera chunks", () => {
  assert.equal(chunkText("   \n\n ").length, 0);
});

test("texto curto vira um chunk só", () => {
  const c = chunkText("# Título\n\nUm parágrafo.");
  assert.equal(c.length, 1);
  assert.equal(c[0].metadata.heading, "Título");
});

test("texto longo é dividido com sobreposição e sem perder conteúdo", () => {
  const paras = Array.from({ length: 40 }, (_, i) => `Parágrafo ${i} ` + "x".repeat(150));
  const chunks = chunkText(paras.join("\n\n"), { maxChars: 1000, overlap: 100 });
  assert.ok(chunks.length > 4);
  chunks.forEach((c, i) => {
    assert.equal(c.index, i);
    assert.ok(c.content.length <= 1100 + 100, `chunk ${i} grande demais`);
  });
  for (let i = 0; i < 40; i++) assert.ok(chunks.some((c) => c.content.includes(`Parágrafo ${i} `)), `faltou parágrafo ${i}`);
});

test("parágrafo gigante sem quebras é fatiado", () => {
  const chunks = chunkText("y".repeat(5000), { maxChars: 1000, overlap: 0 });
  assert.ok(chunks.length >= 5);
});
