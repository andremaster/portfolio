import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConversations } from "../src/lib/chat-export.ts";
import { parseHandoff, handoffPrompt } from "../src/lib/handoff.ts";

test("lê conversa do ChatGPT seguindo o ramo atual", () => {
  const gpt = [{
    id: "c1", title: "API de pagamentos", create_time: 1700000000, current_node: "n3",
    mapping: {
      n0: { message: null, parent: null },
      n1: { message: { author: { role: "user" }, content: { parts: ["Como faço o webhook?"] } }, parent: "n0" },
      n2: { message: { author: { role: "assistant" }, content: { parts: ["Use HMAC."] } }, parent: "n1" },
      nx: { message: { author: { role: "assistant" }, content: { parts: ["ramo descartado"] } }, parent: "n1" },
      n3: { message: { author: { role: "user" }, content: { parts: ["Obrigado"] } }, parent: "n2" },
    },
  }];
  const [c] = parseConversations(gpt);
  assert.equal(c.source, "chatgpt");
  assert.equal(c.messages, 3);
  assert.match(c.text, /Usuário: Como faço o webhook\?\n\nIA: Use HMAC\.\n\nUsuário: Obrigado/);
  assert.doesNotMatch(c.text, /descartado/);
});

test("lê conversa do Claude", () => {
  const claude = [{ uuid: "u1", name: "Arquitetura", created_at: "2026-01-02T00:00:00Z",
    chat_messages: [{ sender: "human", text: "Qual banco?" }, { sender: "assistant", content: [{ type: "text", text: "Postgres." }] }] }];
  const [c] = parseConversations(claude);
  assert.equal(c.source, "claude");
  assert.equal(c.text, "Usuário: Qual banco?\n\nIA: Postgres.");
});

test("ignora conversas vazias e arquivo inválido", () => {
  assert.equal(parseConversations([{ uuid: "x", chat_messages: [] }]).length, 0);
  assert.equal(parseConversations({ nada: true }).length, 0);
});

test("handoff preenche só seções com conteúdo", () => {
  const md = "# HANDOFF\n## Objetivo\nReduzir fraude.\n## Escopo\nnão informado\n## Regras de negócio\n- Limite de R$ 5 mil";
  const r = parseHandoff(md);
  assert.equal(r.objective, "Reduzir fraude.");
  assert.equal(r.scope, undefined);
  assert.equal(r.business_rules, "- Limite de R$ 5 mil");
  assert.match(handoffPrompt("Atlas"), /## Objetivo/);
});
