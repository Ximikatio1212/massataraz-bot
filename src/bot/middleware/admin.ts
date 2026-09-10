import { Middleware } from "grammy";
import { BotContext } from "./auth";
import { userFriendlyError } from "../../utils/errors";

export const adminMiddleware: Middleware<BotContext> = async (ctx, next) => {
  const user = ctx.state.user;
  if (!user) return;

  // Never trust the client; always verify admin on backend.
  if (!isBackendAdmin(user.telegramId)) {
    await ctx.answerCallbackQuery({ text: userFriendlyError("NOT_ADMIN"), show_alert: true });
    return;
  }
  await next();
};

export function isBackendAdmin(telegramId: bigint): boolean {
  const raw = process.env.ADMIN_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(telegramId.toString());
}