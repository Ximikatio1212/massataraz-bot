import { BotContext } from "../middleware/auth";
import { getOrCreateUser, getUserByTelegramId } from "../../services/user.service";
import { prisma } from "../../db/prisma";
import { mainMenuKeyboard } from "../keyboards/main";
import { editText, replyText } from "../helpers";
import { t, langOf } from "../../i18n";

export async function startHandler(ctx: BotContext) {
  const from = ctx.from;
  if (!from) return;

  const user = await getOrCreateUser(
    BigInt(from.id),
    from.username,
    from.first_name,
    from.last_name
  );

  const isAdmin = ctx.state.user?.isAdmin ?? false;
  const lang = user.lang ?? "ru";

  const greeting = isAdmin
    ? `🏋️ <b>MASSA TARAZ</b>\n\nЗдравствуйте, администратор! Выберите раздел:`
    : t(lang, "greeting_user", { name: safeHtml(from.first_name ?? "") });

  await replyText(ctx, greeting, mainMenuKeyboard(isAdmin, lang));
}

export async function handleLangSet(ctx: BotContext, lang: "ru" | "kk") {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  await prisma.user.update({ where: { id: dbUser.id }, data: { lang } }).catch(() => {});

  const isAdmin = ctx.state.user.isAdmin ?? false;
  const text = isAdmin
    ? `🏋️ <b>MASSA TARAZ</b>\n\nЗдравствуйте, администратор! Выберите раздел:`
    : t(lang, "greeting_user", { name: safeHtml(dbUser.firstName ?? "") });

  await editText(ctx, text, mainMenuKeyboard(isAdmin, lang));
}

export async function helpHandler(ctx: BotContext) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  const lang = langOf(dbUser?.lang);
  await replyText(ctx, t(lang, "help"));
}

function safeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}