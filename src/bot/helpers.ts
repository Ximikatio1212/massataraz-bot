import { BotContext } from "./middleware/auth";
import { InlineKeyboard } from "grammy";
import { getUserByTelegramId } from "../services/user.service";
import { getCanvas, saveCanvas } from "../services/state.service";
import { mark } from "../utils/diag";

type RenderOpts = {
  parse_mode: "HTML";
  reply_markup?: InlineKeyboard;
};

function buildOpts(keyboard?: InlineKeyboard): RenderOpts {
  const opts: RenderOpts = { parse_mode: "HTML" };
  if (keyboard) opts.reply_markup = keyboard;
  return opts;
}

async function currentDbUser(ctx: BotContext) {
  if (!ctx.state.user) return null;
  try {
    return await getUserByTelegramId(ctx.state.user.telegramId);
  } catch (e) {
    return null;
  }
}

/**
 * Renders a text screen on the user's single "canvas" message, so the chat
 * does not get cluttered with copies of the interactive menu.
 * - If the canvas exists in this chat: edits it in place, removing any leftover
 *   disposable (media) message the user pressed from.
 * - If the current callback message is editable: reuses it as the canvas.
 * - Otherwise sends a new message and remembers it as the canvas.
 */
export async function renderText(ctx: BotContext, text: string, keyboard?: InlineKeyboard) {
  const opts = buildOpts(keyboard);
  const chatId = ctx.chat?.id;
  if (chatId == null) { console.log("RENDER no chat"); mark("render:no-chat"); return; }

  const dbUser = await currentDbUser(ctx);
  const canvas = dbUser ? await getCanvas(dbUser.id) : null;
  const currentId = ctx.callbackQuery?.message?.message_id;
  const currentChatId = ctx.callbackQuery?.message?.chat?.id;
  console.log("RENDER", String(chatId), "len", text.length, "canvas", canvas ? String(canvas.messageId) : "-", "start-msg", ctx.message?.message_id ?? null, "cb", currentId ?? null);
  mark(`render:${String(chatId)} len=${text.length} canvas=${canvas ? String(canvas.messageId) : "-"}`);

  const canvasId = canvas && canvas.chatId === BigInt(chatId) ? Number(canvas.messageId) : null;

  if (currentChatId === chatId && currentId != null) {
    // Callback: нажатое сообщение гарантированно существует. Редактируем ЕГО —
    // это безопасный первый вызов для webhook reply. Удаление иного сообщения
    // НИКОГДА не делаем первым: на cmh оно съело бы webhook reply, а сам рендер
    // ушёл бы в исходящий вызов и молча пропал.
    const edited = await ctx.api
      .editMessageText(chatId, currentId, text, opts)
      .then(() => true)
      .catch((e) => {
        console.log("RENDER reuse-fail", String(e));
        mark(`render:reuse-fail ${String(e).slice(0, 120)}`);
        return false;
      });
    if (edited) {
      if (dbUser) await saveCanvas(dbUser.id, BigInt(chatId), currentId);
      // Best-effort: убрать старый canvas после успешного рендера (на cmh это
      // исходящий вызов и он безвредно падает; локально — чистит чат).
      if (canvasId != null && canvasId !== currentId) {
        await ctx.api.deleteMessage(chatId, canvasId).catch(() => {});
      }
      console.log("RENDER reused", currentId);
      mark("render:reused");
      return;
    }
    // Нажатое сообщение не редактируется (медиа): идём в отправку нового.
  }

  // Текст/фото/документ без нажатой кнопки, либо нередактируемое нажатие:
  // ОТПРАВЛЯЕМ НОВОЕ СООБЩЕНИЕ первым вызовом. Устаревший canvas никогда не
  // редактируем, иначе первый (webhook-reply) вызов уйдёт в молчаливый сбой.
  const sent = await ctx.reply(text, opts).catch((e) => {
    console.log("RENDER reply-fail", String(e));
    mark(`render:reply-fail ${String(e).slice(0, 120)}`);
    return null;
  });
  console.log("RENDER sent", sent ? String(sent.message_id) : "-");
  mark(`render:sent=${sent ? String(sent.message_id) : "-"}`);
  if (sent) {
    if (dbUser) {
      await saveCanvas(dbUser.id, BigInt(chatId), sent.message_id);
      console.log("RENDER canvas-set", String(sent.message_id));
    }
    // Best-effort: убрать старый canvas после успешной отправки нового.
    if (canvasId != null && sent.message_id !== canvasId) {
      await ctx.api.deleteMessage(chatId, canvasId).catch(() => {});
    }
  }
}

/**
 * Renders a media (photo/document) screen as a disposable message. The text
 * canvas stays untouched below it and is restored whenever the user navigates
 * back with a callback on this media message.
 */
export async function renderMedia(
  ctx: BotContext,
  send: () => Promise<{ message_id: number } | null | undefined>
) {
  const chatId = ctx.chat?.id;
  if (chatId == null) return;

  const dbUser = await currentDbUser(ctx);
  const canvas = dbUser ? await getCanvas(dbUser.id) : null;
  const currentId = ctx.callbackQuery?.message?.message_id;

  // Сама отправка — ПЕРВЫЙ вызов (webhook reply). Никаких deleteMessage до неё:
  // на cmh удаление съело бы reply, а медиа ушло бы в исходящий вызов и пропало.
  const sent = await send().catch(() => null);
  if (!sent) return;

  // Best-effort: подчистить предыдущее disposable-медиа/старый canvas ПОСЛЕ.
  if (canvas && currentId != null && currentId !== Number(canvas.messageId)) {
    await ctx.api.deleteMessage(chatId, Number(canvas.messageId)).catch(() => {});
  }
}

export async function renderPhoto(
  ctx: BotContext,
  photo: string,
  caption: string,
  keyboard?: InlineKeyboard
) {
  const opts = buildOpts(keyboard);
  await renderMedia(ctx, () => ctx.replyWithPhoto(photo, opts).then((m) => m));
}

export async function editText(ctx: BotContext, text: string, keyboard?: InlineKeyboard) {
  await renderText(ctx, text, keyboard);
}

export async function replyText(ctx: BotContext, text: string, keyboard?: InlineKeyboard) {
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.answerCallbackQuery();
    }
  } catch (e) {}
  await renderText(ctx, text, keyboard);
}

export async function replyTextNoAnswer(ctx: BotContext, text: string, keyboard?: InlineKeyboard) {
  await renderText(ctx, text, keyboard);
}

export async function answerAlert(ctx: BotContext, text: string) {
  try {
    await ctx.answerCallbackQuery({ text, show_alert: true });
  } catch (e) {}
}

export async function editHostMessage(ctx: BotContext, messageId: number | undefined, text: string, keyboard?: InlineKeyboard) {
  const opts = buildOpts(keyboard);
  const chatId = ctx.chat?.id;
  if (chatId && messageId) {
    try {
      await ctx.api.editMessageText(chatId, messageId, text, opts);
      return;
    } catch (e) {
      // fall through to canvas render
    }
  }
  await renderText(ctx, text, keyboard);
}

export function safeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}