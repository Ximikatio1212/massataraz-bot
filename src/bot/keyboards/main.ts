import { InlineKeyboard } from "grammy";

export function mainMenuKeyboard(isAdmin: boolean) {
  const kb = new InlineKeyboard();

  kb.row()
    .text("🛍 Фармакология", "catalog:start")
    .text("📚 Готовые связки", "courses:list")
    .row()
    .text("🛒 Корзина", "cart:view")
    .text("📦 Мои заказы", "orders:list");

  if (isAdmin) {
    kb.row().text("⚙️ Админ-панель", "admin:menu");
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