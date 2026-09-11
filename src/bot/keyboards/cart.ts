import { InlineKeyboard } from "grammy";
import { CartView } from "../../types";
import { t } from "../../i18n";

export function cartKeyboard(userId: number, cart: CartView, lang?: string) {
  const kb = new InlineKeyboard();

  cart.items.forEach((item) => {
    const icon = item.type === "course" ? "📚" : "💊";
    const label = item.name.length > 32 ? `${item.name.slice(0, 32)}…` : item.name;
    kb.text(`${icon} ${label} — ${item.quantity} ${t(lang, "unit_pcs")}`, `cart:item:view:${item.cartItemId}`);
    kb.row();
  });

  if (cart.items.length > 0) {
    kb.text(t(lang, "btn_clear_cart"), "cart:clear");
    kb.row();
    kb.text(t(lang, "btn_go_pay"), "checkout:start");
    kb.row();
  }
  kb.text(t(lang, "btn_back_main"), "main:menu");
  return kb;
}

export function cartItemKeyboard(cartItemId: number, lang?: string) {
  return new InlineKeyboard()
    .text("➖", `cart:item:dec:${cartItemId}`)
    .text(t(lang, "btn_del"), `cart:item:del:${cartItemId}`)
    .text("➕", `cart:item:inc:${cartItemId}`)
    .row()
    .text(t(lang, "btn_back_cart"), "cart:view");
}

export function cartConfirmKeyboard(lang?: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_confirm_ok"), "checkout:confirm")
    .row()
    .text(t(lang, "btn_edit"), "checkout:edit")
    .row()
    .text(t(lang, "btn_cancel"), "checkout:cancel");
}

export function checkoutStartKeyboard(lang?: string) {
  return new InlineKeyboard()
    .text(t(lang, "btn_attach_check"), "checkout:receipt")
    .row()
    .text(t(lang, "btn_fill_data"), "checkout:data")
    .row()
    .text(t(lang, "btn_cancel"), "checkout:cancel");
}