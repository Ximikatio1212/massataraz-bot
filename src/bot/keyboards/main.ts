import { InlineKeyboard } from "grammy";

export function mainMenuKeyboard(isAdmin: boolean) {
  const kb = new InlineKeyboard();

  kb.text("🛍 Фармакология", "catalog:start");
  kb.row();
  kb.text("📚 Готовые связки", "courses:list");
  kb.row();
  kb.text("🛒 Корзина", "cart:view");
  kb.row();
  kb.text("📦 Мои заказы", "orders:list");

  if (isAdmin) {
    kb.row();
    kb.text("⚙️ Админ-панель", "admin:menu");
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
    .row()
    .text("💳 Оплаты", "admin:payments")
    .row()
    .text("👥 Клиенты", "admin:clients")
    .row()
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