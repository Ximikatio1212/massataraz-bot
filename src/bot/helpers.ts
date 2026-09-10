import { BotContext } from "./middleware/auth";
import { InlineKeyboard } from "grammy";

export async function editText(ctx: BotContext, text: string, keyboard?: InlineKeyboard) {
  const opts: any = { parse_mode: "HTML" };
  if (keyboard) opts.reply_markup = keyboard;

  try {
    if (ctx.callbackQuery?.message) {
      const isEdited = await ctx.editMessageText(text, opts).catch(async () => false);
      if (!isEdited) {
        // Fallback: delete old and send new
        await ctx.answerCallbackQuery().catch(() => {});
        await ctx.deleteMessage().catch(() => {});
        await ctx.reply(text, opts);
      }
      return;
    }
  } catch (e) {
    // fall through
  }
  await ctx.reply(text, opts).catch(() => {});
}

export async function replyText(ctx: BotContext, text: string, keyboard?: InlineKeyboard) {
  const opts: any = { parse_mode: "HTML" };
  if (keyboard) opts.reply_markup = keyboard;
  try {
    if (ctx.callbackQuery?.message) {
      await ctx.answerCallbackQuery();
    }
  } catch (e) {}
  await ctx.reply(text, opts).catch(() => {});
}

export async function replyTextNoAnswer(ctx: BotContext, text: string, keyboard?: InlineKeyboard) {
  const opts: any = { parse_mode: "HTML" };
  if (keyboard) opts.reply_markup = keyboard;
  await ctx.reply(text, opts).catch(() => {});
}

export async function answerAlert(ctx: BotContext, text: string) {
  try {
    await ctx.answerCallbackQuery({ text, show_alert: true });
  } catch (e) {}
}

export function safeText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}