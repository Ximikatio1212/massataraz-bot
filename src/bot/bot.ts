import { Bot } from "grammy";
import { BotContext, authMiddleware } from "./middleware/auth";
import { handleCallback, handleTextMessage, handleReceiptUpload, handleAdminPhoto, handleAdminDocument, handleAnyMessage } from "./router";
import { startHandler, helpHandler } from "./handlers/start";
import { setBotInstance } from "../instance";

export function createBot(): Bot<BotContext> {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not set");

  const bot = new Bot<BotContext>(token);
  setBotInstance(bot);

  bot.use(authMiddleware);

  bot.command("start", (ctx) => startHandler(ctx));
  bot.command("help", (ctx) => helpHandler(ctx));

  bot.on("callback_query:data", (ctx) => {
    const data = ctx.callbackQuery.data;
    return handleCallback(ctx, data);
  });

  bot.on("message:text", (ctx) => {
    if (ctx.message.text.startsWith("/")) return;
    return handleTextMessage(ctx);
  });

  bot.on("message:photo", (ctx) => handleReceiptUpload(ctx).then(() => handleAdminPhoto(ctx)));
  bot.on("message:document", (ctx) => handleReceiptUpload(ctx).then(() => handleAdminDocument(ctx)));

  bot.catch((err) => {
    console.error("Bot error:", err.error);
  });

  return bot;
}

export async function processUpdate(update: any): Promise<void> {
  const bot = createBot();
  await bot.handleUpdate(update);
}

export async function setWebhook(url: string): Promise<void> {
  const bot = createBot();
  await bot.api.setWebhook(url);
}

export async function deleteWebhook(): Promise<void> {
  const bot = createBot();
  await bot.api.deleteWebhook();
}