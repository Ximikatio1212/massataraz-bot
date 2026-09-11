import { test } from "node:test";
import assert from "node:assert/strict";
import { trimAiMessages } from "../src/services/ai.service";

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