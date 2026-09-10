import { Context, Middleware } from "grammy";

export interface SessionUser {
  userId: number;
  telegramId: bigint;
  isAdmin: boolean;
}

export interface BotContext extends Context {
  state: {
    user?: SessionUser;
  };
}

export const authMiddleware: Middleware<BotContext> = async (ctx, next) => {
  ctx.state = {};
  const from = ctx.from;
  if (!from) return;
  ctx.state.user = {
    userId: Number(from.id),
    telegramId: BigInt(from.id),
    isAdmin: isAdminUser(BigInt(from.id)),
  };
  await next();
};

function isAdminUser(telegramId: bigint): boolean {
  const raw = process.env.ADMIN_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(telegramId.toString());
}