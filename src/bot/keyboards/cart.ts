import { InlineKeyboard } from "grammy";
import { CartView } from "../../types";

export function cartKeyboard(userId: number, cart: CartView) {
  const kb = new InlineKeyboard();

  cart.items.forEach((item) => {
    const icon = item.type === "course" ? "📚" : "💊";
    const label = item.name.length > 32 ? `${item.name.slice(0, 32)}…` : item.name;
    kb.text(`${icon} ${label} — ${item.quantity} шт`, `cart:item:view:${item.cartItemId}`);
    kb.row();
  });

  if (cart.items.length > 0) {
    kb.text("🧹 Очистить корзину", "cart:clear");
    kb.row();
    kb.text("💳 Перейти к оплате", "checkout:start");
    kb.row();
  }
  kb.text("⬅️ Главное меню", "main:menu");
  return kb;
}

export function cartItemKeyboard(cartItemId: number) {
  return new InlineKeyboard()
    .text("➖", `cart:item:dec:${cartItemId}`)
    .text("🗑 Удалить", `cart:item:del:${cartItemId}`)
    .text("➕", `cart:item:inc:${cartItemId}`)
    .row()
    .text("⬅️ Назад в корзину", "cart:view");
}

export function cartConfirmKeyboard() {
  return new InlineKeyboard()
    .text("✅ Всё верно", "checkout:confirm")
    .row()
    .text("✏️ Изменить", "checkout:edit")
    .row()
    .text("❌ Отмена", "checkout:cancel");
}

export function checkoutStartKeyboard() {
  return new InlineKeyboard()
    .text("📎 Прикрепить чек", "checkout:receipt")
    .row()
    .text("📝 Заполнить данные", "checkout:data")
    .row()
    .text("❌ Отмена", "checkout:cancel");
}