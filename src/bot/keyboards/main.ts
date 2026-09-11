import { InlineKeyboard } from "grammy";
import { t } from "../../i18n";

export function mainMenuKeyboard(isAdmin: boolean, lang?: string) {
  const kb = new InlineKeyboard();

  kb.row()
    .text(t(lang, "btn_catalog"), "catalog:start")
    .text(t(lang, "btn_courses"), "courses:list")
    .row()
    .text(t(lang, "btn_cart"), "cart:view")
    .text(t(lang, "btn_orders"), "orders:list")
    .row()
    .text(t(lang, "btn_consultant"), "assistant:start");

  if (isAdmin) {
    kb.row().text(t(lang, "btn_admin"), "admin:menu");
  } else {
    kb.row()
      .text(t(lang, "btn_lang_ru"), "lang:ru")
      .text(t(lang, "btn_lang_kk"), "lang:kk");
  }

  return kb;
}

export function adminMenuKeyboard() {
  return new InlineKeyboard()
    .text("📦 Товары", "admin:products")
    .row()
    .text("📁 Категории", "admin:categories")
    .row()
    .text("📚 Готовые связки", "admin:courses")
    .row()
    .text("🛒 Заказы", "admin:orders")
    .text("💳 Оплаты", "admin:payments")
    .row()
    .text("👥 Клиенты", "admin:clients")
    .text("📊 Статистика", "admin:statistics")
    .row()
    .text("🤖 ИИ-ассистент", "assistant:start")
    .row()
    .text("⬅️ Главное меню", "main:menu");
}

export function backToMainKeyboard() {
  return new InlineKeyboard().text("⬅️ Главное меню", "main:menu");
}

export function yesNoKeyboard(actionPrefix: string, id: number) {
  return new InlineKeyboard()
    .text("✅ Да", `${actionPrefix}:yes:${id}`)
    .row()
    .text("❌ Нет", `${actionPrefix}:no:${id}`);
}

export function confirmCancelKeyboard(confirmCb: string) {
  return new InlineKeyboard()
    .text("✅ Да", confirmCb)
    .row()
    .text("❌ Отмена", "cancel:current");
}