import type { Handler } from "@netlify/functions";
import { processUpdate } from "../../src/bot/bot";
import { logError } from "../../src/utils/errors";
import { markProcessedUpdate, verifyWebhookSecret } from "../../src/services/webhook.service";
import { diag, mark, resetDiag } from "../../src/utils/diag";

// Журнал обработки апдейта пишется в БД (Neon), т.к. логи Netlify Functions
// на регионе cmh недоступны, а ответ webhook-запроса видит только Telegram.
async function persistDiag(record: {
  updateId: number;
  chatId?: number;
  fromId?: number;
  reply: boolean;
  replyMethod?: string | null;
  noReplyReason: string;
  error?: string | null;
}) {
  try {
    const { prisma } = await import("../../src/db/prisma");
    await prisma.webhookDiag
      .create({
        data: {
          updateId: BigInt(record.updateId),
          chatId: record.chatId != null ? BigInt(record.chatId) : null,
          fromId: record.fromId != null ? BigInt(record.fromId) : null,
          reply: record.reply,
          replyMethod: record.replyMethod ?? null,
          noReplyReason: record.noReplyReason,
          diag: JSON.stringify(diag),
          error: record.error ?? null,
        },
      })
      .catch(() => {});
  } catch {
    // Диагностика не должна ронять обработку апдейта
  }
}

// Cold-start warm-up: on Netlify/AWS Lambda the first outbound HTTPS from a new
// container may fail with "Network request failed" (DNS/TLS not yet primed).
// Fire a lightweight request at module load so the network stack is ready before
// the first webhook arrives.  Fire-and-forget — errors are harmless.
const _warmup = fetch("https://api.telegram.org/").catch(() => {});

const PROCESS_TIMEOUT_MS = 25_000;

function withTimeout(promise: Promise<void>, ms: number): Promise<"ok" | "timeout"> {
  return Promise.race([
    promise.then(() => "ok" as const),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms)),
  ]);
}

async function notifyAdminError(error: any, updateId?: number) {
  const token = process.env.BOT_TOKEN;
  const raw = process.env.ADMIN_IDS ?? "";
  const adminIds = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!token || adminIds.length === 0) return;

  const text =
    `⚠️ <b>Webhook error</b> update ${updateId ?? "?"}\n\n` +
    `<code>${String(error?.message ?? error).slice(0, 1500)}</code>`;

  for (const id of adminIds) {
    try {
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: id, text, parse_mode: "HTML" }),
      });
    } catch {
      // ignore
    }
  }
}

export const handler: Handler = async (event) => {
  resetDiagWithLog();
  mark(`wh:start`);

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  // Проверяем секрет от Telegram, если задан
  const secretHeader = event.headers["x-telegram-bot-api-secret-token"];
  if (!verifyWebhookSecret(secretHeader)) {
    mark(`wh:unauthorized`);
    return {
      statusCode: 401,
      body: "Unauthorized",
    };
  }

  if (!event.body) {
    mark(`wh:no-body`);
    return {
      statusCode: 400,
      body: "Bad Request",
    };
  }

  let update: any;
  try {
    update = JSON.parse(event.body);
    mark(`wh:json-ok`);
  } catch (e) {
    mark(`wh:json-fail`);
    return {
      statusCode: 400,
      body: "Invalid JSON",
    };
  }

  const uid = update?.update_id;
  console.log("WH start", uid);

  // Дедупликация: Telegram ретраит апдейт при таймауте. Пропускаем повторы.
  let isNew: boolean;
  try {
    isNew = await markProcessedUpdate(uid);
    mark(`wh:dedup=${isNew}`);
  } catch (e: any) {
    isNew = true;
    mark(`wh:dedup=err ${String(e?.message ?? e)}`);
    console.log("WH dedup-err", uid, String(e?.message ?? e));
  }
  console.log("WH dedup", uid, isNew);
  if (!isNew) {
    mark(`wh:done dup`);
    return {
      statusCode: 200,
      body: "ok",
    };
  }

  async function runWithReply(): Promise<string | null> {
    // Webhook reply: грамми может ответить на апдейт прямо в теле HTTP-ответа
    // webhook-запроса ({"method":"...", ...}), не делая исходящего запроса к
    // api.telegram.org. Захватываем тело ответа и отдаём его как тело функции.
    let replyBody: string | null = null;
    const webhookReplyEnvelope = {
      async send(json: string) {
        replyBody = json;
        mark(`wh:reply captured ${json.slice(0, 80)}`);
      },
    };
    const outcome = await withTimeout(processUpdate(update, webhookReplyEnvelope), PROCESS_TIMEOUT_MS);
    console.log("WH done", uid, outcome, "reply", replyBody != null);
    mark(`wh:processed=${outcome}`);
    mark(`wh:reply=${replyBody != null}`);
    return replyBody;
  }

  let noReplyReason = "none";
  let errorMsg: string | null = null;
  let replyMethod: string | null = null;

  const chatId = Number(
    update?.callback_query?.message?.chat?.id ?? update?.message?.chat?.id ?? update?.edited_message?.chat?.id ?? NaN
  );
  const fromId = Number(
    update?.callback_query?.from?.id ?? update?.message?.from?.id ?? update?.edited_message?.from?.id ?? NaN
  );

  const persist = (reply: boolean) =>
    persistDiag({
      updateId: update?.update_id as number,
      chatId: Number.isFinite(chatId) ? chatId : undefined,
      fromId: Number.isFinite(fromId) ? fromId : undefined,
      reply,
      replyMethod,
      noReplyReason,
      error: errorMsg,
    });

  try {
    const replyBody = await runWithReply();
    if (replyBody) {
      // Тело — готовый JSON-запрос к Bot API: Telegram сам отправит сообщение.
      try {
        replyMethod = (JSON.parse(replyBody) as any)?.method ?? null;
      } catch {}
  
      mark(`wh:return reply`);
      await persist(true);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: replyBody,
      };
    }
    noReplyReason = "no-reply-captured";
  } catch (e) {
    const errMsg = String((e as any)?.message ?? (e as any)?.error?.message ?? e);
    console.log("WH error", uid, errMsg);
    mark(`wh:error ${errMsg}`);

    if (errMsg.includes("Network request") || errMsg.includes("ENOTFOUND")) {
      console.log("WH retry", uid);
      mark(`wh:retry`);
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const retryReply = await runWithReply();
        if (retryReply) {
          try {
            replyMethod = (JSON.parse(retryReply) as any)?.method ?? null;
          } catch {}

          mark(`wh:return reply(retry)`);
          await persist(true);
          return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: retryReply,
          };
        }
        noReplyReason = "no-reply-captured-after-retry";
      } catch (e2) {
        noReplyReason = "retry-failed";
        errorMsg = String((e2 as any)?.message ?? e2);
        console.log("WH retry-failed", uid, errorMsg);
        logError("telegram-webhook", e2, { updateId: uid });
        await notifyAdminError(e2, uid);
        mark(`wh:retry-fail ${errorMsg}`);
      }
    } else {
      noReplyReason = "error";
      errorMsg = errMsg;
      logError("telegram-webhook", e, { updateId: uid });
      await notifyAdminError(e, uid);
    }
  }

  // Всегда отвечаем 200: иначе Telegram будет ретраить апдейт. Тело — JSON с
  // диагностикой: для Telegram оно безвредно, а для синтетических тестов
  // показывает точное место сбоя.
  mark(`wh:final no-reply (${noReplyReason})`);
  console.log("WH final", uid, JSON.stringify({ noReplyReason, diag }));
  await persist(false);
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ok: true, reply: false, noReplyReason, diag }),
  };
};

function resetDiagWithLog() {
  resetDiag();
  console.log("WH diag reset");
}
