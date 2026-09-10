import { Bot } from "grammy";
import { BotContext } from "./bot/middleware/auth";

let bot: Bot<BotContext> | null = null;

export function setBotInstance(b: Bot<BotContext>) {
  bot = b;
}

export function getBot(): Bot<BotContext> {
  if (!bot) {
    const token = process.env.BOT_TOKEN;
    if (!token) throw new Error("BOT_TOKEN not set");
    bot = new Bot<BotContext>(token);
  }
  return bot;
}

export function getApi() {
  return getBot().api;
}