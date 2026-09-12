import { BotContext } from "../middleware/auth";
import { renderText } from "../helpers";
import { getUserByTelegramId } from "../../services/user.service";
import { setAiMode } from "../../services/ai.service";
import { mainMenuKeyboard, adminMenuKeyboard } from "../keyboards/main";
import { t } from "../../i18n";

export async function handleAssistantStart(ctx: BotContext) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";
  const isAdmin = ctx.state.user.isAdmin;

  await setAiMode(dbUser.id, true);

  // Для клиента включаем режим вопросов «с чистого листа»: сбрасываем застрявшие
  // визарды оформления, чтобы свободный текст шёл в ИИ, а не блокировался чек-флоу.
  if (!isAdmin) {
    const { resetState } = await import("../../services/state.service");
    await resetState(dbUser.id).catch(() => {});
  }
  const text = isAdmin
    ? "🤖 <b>ИИ-ассистент активен.</b>\n\nНапишите, что нужно сделать."
    : t(lang, "assistant_client_active");

  const kb = isAdmin ? adminMenuKeyboard() : mainMenuKeyboard(isAdmin, lang);
  await renderText(ctx, text, kb);
}

export async function handleAssistantStop(ctx: BotContext) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  await setAiMode(dbUser.id, false);
  const isAdmin = ctx.state.user.isAdmin;
  await renderText(
    ctx,
    t(lang, "assistant_stop"),
    isAdmin ? adminMenuKeyboard() : mainMenuKeyboard(isAdmin, lang)
  );
}