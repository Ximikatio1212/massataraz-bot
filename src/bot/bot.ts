import { Bot } from "grammy";
import { BotContext, authMiddleware } from "./middleware/auth";
import { handleCallback, handleTextMessage, handleReceiptUpload, handleAdminPhoto, handleAdminDocument } from "./router";
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

// Singleton в рамках одного warm-инстанса serverless-функции.
// Это устраняет повторное создание бота и лишний вызов bot.init() на каждый апдейт.
let botInstancePromise: Promise<Bot<BotContext>> | null = null;
let commandsSet = false;

async function getBotInstance(): Promise<Bot<BotContext>> {
  if (!botInstancePromise) {
    botInstancePromise = (async () => {
      const bot = createBot();
      await bot.init();
      if (!commandsSet) {
        commandsSet = true;
        await bot.api
          .setMyCommands([
            { command: "start", description: "🏠 Главное меню" },
            { command: "help", description: "ℹ️ Помощь" },
          ])
          .catch(() => {});
      }
      return bot;
    })();
  }
  return botInstancePromise;
}

export async function processUpdate(update: any): Promise<void> {
  const bot = await getBotInstance();
  await bot.handleUpdate(update);
}

export async function setWebhook(url: string, secret?: string): Promise<void> {
  const bot = createBot();
  await bot.api.setWebhook(url, secret ? { secret_token: secret } : {});
}

export async function deleteWebhook(): Promise<void> {
  const bot = createBot();
  await bot.api.deleteWebhook();
}

// Только для локального тестирования / сброса кэша
export function resetBotInstanceCache(): void {
  botInstancePromise = null;
  commandsSet = false;
}