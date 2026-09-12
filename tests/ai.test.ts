import { test } from "node:test";
import assert from "node:assert/strict";
import { trimAiMessages, normalizeToolMessages } from "../src/services/ai.service";

test("trimAiMessages: truncates long tool content", () => {
  const input = [
    { role: "user", content: "привет" },
    { role: "tool", content: "x".repeat(2000), tool_call_id: "call_1" },
  ];
  const out = trimAiMessages(input);
  assert.equal(out.length, 2);
  const tool = out.find((m) => m.role === "tool")!;
  assert.ok(tool.content!.length < 700, "tool content должен быть обрезан");
  assert.ok(tool.content!.endsWith("…(обрезано)"));
});

test("trimAiMessages: keeps last 20 messages only", () => {
  const input = Array.from({ length: 30 }, (_, i) => ({
    role: "user",
    content: `msg${i}`,
  }));
  const out = trimAiMessages(input);
  assert.equal(out.length, 20);
  assert.equal(out[0].content, "msg10");
  assert.ok(out[19].content === "msg29");
});

test("trimAiMessages: drops non-message input", () => {
  assert.deepEqual(trimAiMessages(undefined as any), []);
  assert.deepEqual(trimAiMessages("string" as any), []);
  assert.deepEqual(trimAiMessages(null as any), []);
});

test("trimAiMessages: preserves tool_calls metadata", () => {
  const input = [
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "call_1", type: "function", function: { name: "x", arguments: "{}" } }],
    },
    { role: "tool", content: "{{[]}}", tool_call_id: "call_1" },
  ];
  const out = trimAiMessages(input);
  assert.equal(out[0].tool_calls?.length, 1);
  assert.equal(out[1].tool_call_id, "call_1");
});

test("normalizeToolMessages: добавляет name tool-сообщению из предшествующего вызова", () => {
  const out = normalizeToolMessages([
    {
      role: "assistant",
      content: null,
      tool_calls: [{ id: "call_1", type: "function", function: { name: "list_products", arguments: "{}" } }],
    },
    { role: "tool", content: "[]", tool_call_id: "call_1" },
    { role: "user", content: "спасибо" },
  ]);
  const tool = out.find((m) => m.role === "tool")!;
  assert.equal(tool.name, "list_products");
});

test("normalizeToolMessages: отбрасывает tool-сообщения без распознаваемого вызова", () => {
  const out = normalizeToolMessages([
    { role: "assistant", content: "ок", tool_calls: [{ id: "call_x", type: "function", function: { name: "get_order_status", arguments: "{}" } }] },
    { role: "tool", content: "[]", tool_call_id: "call_unknown" },
    { role: "user", content: "далее" },
  ]);
  assert.equal(out.filter((m) => m.role === "tool").length, 0);
  assert.equal(out.length, 2);
});

test("normalizeToolMessages: не трогает сообщения с явным name", () => {
  const out = normalizeToolMessages([{ role: "tool", content: "x", tool_call_id: "call_9", name: "list_categories" }]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "list_categories");
});