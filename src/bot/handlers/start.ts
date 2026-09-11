import { BotContext } from "../middleware/auth";
import { getOrCreateUser } from "../../services/user.service";
import { mainMenuKeyboard } from "../keyboards/main";
import { editText, replyText } from "../helpers";

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
  const greeting = isAdmin
    ? `🏋️ <b>MASSA TARAZ</b>\n\nЗдравствуйте, администратор! Выберите раздел:`
    : `🏋️ <b>MASSA TARAZ</b>\n\nПривет, ${safeHtml(from.first_name ?? "")}! Выберите раздел:`;

  await replyText(ctx, greeting, mainMenuKeyboard(isAdmin));
}

export async function helpHandler(ctx: BotContext) {
  await replyText(
    ctx,
    `🏋️ <b>Massa Taraz</b>\n\nМагазин спортивного питания.\n\nИспользуйте меню для покупок. По всем вопросам — напишите нам @massataraz08.`
  );
}

function safeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}