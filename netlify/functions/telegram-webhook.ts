import type { Handler } from "@netlify/functions";
import { processUpdate } from "../../src/bot/bot";
import { logError } from "../../src/utils/errors";
import { markProcessedUpdate, verifyWebhookSecret } from "../../src/services/webhook.service";

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
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  // Проверяем секрет от Telegram, если задан
  const secretHeader = event.headers["x-telegram-bot-api-secret-token"];
  if (!verifyWebhookSecret(secretHeader)) {
    return {
      statusCode: 401,
      body: "Unauthorized",
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: "Bad Request",
    };
  }

  let update: any;
  try {
    update = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: "Invalid JSON",
    };
  }

  // Дедупликация: Telegram ретраит апдейт при таймауте. Пропускаем повторы.
  const isNew = await markProcessedUpdate(update?.update_id);
  if (!isNew) {
    return {
      statusCode: 200,
      body: "ok",
    };
  }

  try {
    await processUpdate(update);
  } catch (e) {
    logError("telegram-webhook", e, {
      updateId: update?.update_id,
    });
    await notifyAdminError(e, update?.update_id);
  }

  // Always respond 200; Telegram will retry otherwise.
  return {
    statusCode: 200,
    body: "ok",
  };
};