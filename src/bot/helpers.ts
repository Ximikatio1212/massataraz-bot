import { BotContext } from "./middleware/auth";
import { InlineKeyboard } from "grammy";
import { getUserByTelegramId } from "../services/user.service";
import { getCanvas, saveCanvas } from "../services/state.service";

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
  if (chatId == null) return;

  const dbUser = await currentDbUser(ctx);
  const canvas = dbUser ? await getCanvas(dbUser.id) : null;

  const currentId = ctx.callbackQuery?.message?.message_id;
  const currentChatId = ctx.callbackQuery?.message?.chat?.id;

  if (canvas && canvas.chatId === BigInt(chatId)) {
    const canvasId = Number(canvas.messageId);
    // Remove the message that triggered the callback if it is a disposable media screen.
    if (currentChatId === chatId && currentId != null && currentId !== canvasId) {
      await ctx.deleteMessage().catch(() => {});
    }
    const edited = await ctx.api
      .editMessageText(chatId, canvasId, text, opts)
      .then(() => true)
      .catch(() => false);
    if (edited) return;
    if (currentId === canvasId) return;

    // Canvas was deleted by the user: fall through to recreate it.
    if (currentChatId === chatId && currentId != null) {
      const reused = await ctx.api
        .editMessageText(chatId, currentId, text, opts)
        .then(() => true)
        .catch(() => false);
      if (reused) {
        await saveCanvas(dbUser!.id, BigInt(chatId), currentId);
        return;
      }
      await ctx.deleteMessage().catch(() => {});
    }
  } else if (currentChatId === chatId && currentId != null) {
    // No canvas yet: reuse the pressed message if possible (e.g. it is a text menu).
    const reused = await ctx.api
      .editMessageText(chatId, currentId, text, opts)
      .then(() => true)
      .catch(() => false);
    if (reused) {
      if (dbUser) await saveCanvas(dbUser.id, BigInt(chatId), currentId);
      return;
    }
    // Pressed message is not editable (photo): remove it to keep the chat clean.
    await ctx.deleteMessage().catch(() => {});
  }

  const sent = await ctx.reply(text, opts).catch(() => null);
  if (sent && dbUser) {
    await saveCanvas(dbUser.id, BigInt(chatId), sent.message_id);
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
  // Remove a previous disposable media screen when navigating media -> media,
  // so the canvas stays as the only stable message.
  if (canvas && currentId != null && currentId !== Number(canvas.messageId)) {
    await ctx.deleteMessage().catch(() => {});
  }

  const sent = await send().catch(() => null);
  if (!sent) return;

  if (canvas) {
    // A text canvas stays as the only stable menu; media is disposable.
    // If the previous current message was the previous media screen it was
    // already removed above.
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