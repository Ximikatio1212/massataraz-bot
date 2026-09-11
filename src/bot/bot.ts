import { Bot } from "grammy";
import { BotContext, authMiddleware } from "./middleware/auth";
import { handleCallback, handleTextMessage, handleReceiptUpload, handleAdminPhoto, handleAdminDocument } from "./router";
import { startHandler, helpHandler } from "./handlers/start";
import { setBotInstance } from "../instance";

export function createBot(): Bot<BotContext> {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error("BOT_TOKEN is not set");

  // Работаем в webhook-режиме: bot.init() (getMe) на старте из Lambda мог висеть
  // до 30с на первом исходящем HTTPS-запросе к api.telegram.org. Неизменный
  // botInfo известен и задаётся сразу, без сетевого вызова.
  const bot = new Bot<BotContext>(token, {
    botInfo: {
      id: Number(token.split(":")[0]),
      is_bot: true,
      first_name: "MASSA TARAZ",
      username: "massashop_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      supports_guest_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
      has_topics_enabled: false,
      allows_users_to_create_topics: false,
      can_manage_bots: false,
      supports_join_request_queries: false,
    },
  });
  setBotInstance(bot);

  bot.use(authMiddleware);

  bot.command("start", (ctx) => startHandler(ctx));
  bot.command("help", (ctx) => helpHandler(ctx));

  bot.on("callback_query:data", (ctx) => {
    const data = ctx.callbackQuery.data;
    return handleCallback(ctx, data);
  });

  bot.on("message:text", async (ctx) => {
    console.log("MSG text", ctx.chat?.id, JSON.stringify(ctx.message.text?.slice(0, 40)));
    if (ctx.message.text.startsWith("/")) return;
    const consumed = await handleTextMessage(ctx);
    console.log("MSG consumed", consumed);
    if (!consumed) {
      await handleAiOrMenu(ctx, ctx.message.text);
    }
    await deleteIncomingMessage(ctx);
  });

  bot.on("message:photo", async (ctx) => {
    const consumed = (await handleReceiptUpload(ctx)) || (await handleAdminPhoto(ctx));
    if (!consumed) {
      await handleAiOrMenu(ctx);
    }
    await deleteIncomingMessage(ctx);
  });

  bot.on("message:document", async (ctx) => {
    const consumed = await handleReceiptUpload(ctx);
    await handleAdminDocument(ctx);
    if (!consumed) {
      await handleAiOrMenu(ctx);
    }
    await deleteIncomingMessage(ctx);
  });

  bot.catch((err) => {
    console.error("Bot error:", err.error);
    throw err;
  });

  return bot;
}

/**
 * Свободное сообщение без активного сценария: отвечает ИИ-ассистент (если
 * настроен), иначе просто показываем главное меню. Оба варианта рендерятся на
 * canvas, поэтому панель всегда остаётся на виду.
 */
export async function handleAiOrMenu(ctx: BotContext, text?: string) {
  if (!(await shouldReplyWithAi(ctx))) {
    await startHandler(ctx);
    return;
  }
  const { handleAiChat } = await import("../services/ai.service");
  const isAdmin = ctx.state.user?.isAdmin ?? false;
  const reply = await handleAiChat(ctx, text ?? "");
  if (!reply) {
    await startHandler(ctx);
    return;
  }
  await startHandlerToRender(ctx, reply, isAdmin);
}

async function startHandlerToRender(ctx: BotContext, aiReply: string, isAdmin: boolean) {
  const { renderText } = await import("./helpers");
  const { mainMenuKeyboard } = await import("./keyboards/main");
  const { getUserByTelegramId } = await import("../services/user.service");
  let lang = "ru";
  try {
    const dbUser = ctx.state.user ? await getUserByTelegramId(ctx.state.user.telegramId) : null;
    lang = dbUser?.lang ?? "ru";
  } catch {}
  await renderText(ctx, aiReply, mainMenuKeyboard(isAdmin, lang));
}

async function shouldReplyWithAi(ctx: BotContext): Promise<boolean> {
  const { aiEnabled, getAiMode } = await import("../services/ai.service");
  if (!aiEnabled()) return false;
  const { getUserByTelegramId } = await import("../services/user.service");
  const dbUser = ctx.state.user ? await getUserByTelegramId(ctx.state.user.telegramId) : null;
  if (!dbUser) return false;
  if (ctx.state.user?.isAdmin) return true;
  return dbUser.aiMode;
}

// Удаляем сообщение, которое прислал пользователь (текст, фото, документ), чтобы
// чат-панель не уезжала вверх и оставалась всегда на виду.
async function deleteIncomingMessage(ctx: BotContext) {
  const msg = ctx.message;
  const chatId = ctx.chat?.id;
  if (!msg || chatId == null) return;
  await ctx.api.deleteMessage(chatId, msg.message_id).catch(() => {});
}

// Singleton в рамках одного warm-инстанса serverless-функции.
// Это устраняет повторное создание бота и лишний вызов bot.init() на каждый апдейт.
let botInstancePromise: Promise<Bot<BotContext>> | null = null;
let commandsSet = false;

async function getBotInstance(): Promise<Bot<BotContext>> {
  if (!botInstancePromise) {
    botInstancePromise = (async () => {
      console.log("BOT create");
      const bot = createBot();
      // bot.init() (getMe) пропущен: к webhook-апдейтам он не нужен, а первый
      // исходящий HTTPS к api.telegram.org из Lambda мог висеть до 30с.
      if (!commandsSet) {
        commandsSet = true;
        // Fire-and-forget — команды уже выставлены, повторная установка не обязательна.
        bot.api
          .setMyCommands([
            { command: "start", description: "🏠 Главное меню" },
            { command: "help", description: "ℹ️ Помощь" },
          ])
          .catch(() => {});
      }
      console.log("BOT ready");
      return bot;
    })();
  }
  return botInstancePromise;
}

export async function processUpdate(update: any): Promise<void> {
  const bot = await getBotInstance();
  console.log("BOT handleUpdate start");
  await bot.handleUpdate(update);
  console.log("BOT handleUpdate done");
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