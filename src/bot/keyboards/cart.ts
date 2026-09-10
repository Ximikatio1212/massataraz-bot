import { InlineKeyboard } from "grammy";
import { CartView } from "../../types";

export function cartKeyboard(userId: number, cart: CartView) {
  const kb = new InlineKeyboard();

  cart.items.forEach((item, index) => {
    kb.text(`➕`, `cart:item:inc:${item.cartItemId}`)
      .text(`➖`, `cart:item:dec:${item.cartItemId}`)
      .text(`🗑`, `cart:item:del:${item.cartItemId}`);
    if ((index + 1) % 2 === 0) kb.row();
  });
  if (cart.items.length % 2 !== 0) kb.row();

  if (cart.items.length > 0) {
    kb.text("🧹 Очистить корзину", "cart:clear");
    kb.row();
    kb.text("💳 Перейти к оплате", "checkout:start");
    kb.row();
  }
  kb.text("⬅️ Главное меню", "main:menu");
  return kb;
}

export function cartConfirmKeyboard() {
  return new InlineKeyboard()
    .text("✅ Всё верно", "checkout:confirm")
    .row()
    .text("✏️ Изменить", "checkout:edit")
    .row()
    .text("❌ Отмена", "checkout:cancel");
}