import { InlineKeyboard } from "grammy";
import { Category } from "@prisma/client";

export function categoriesKeyboard(categories: Category[], backCb = "main:menu") {
  const kb = new InlineKeyboard();

  categories.forEach((cat, index) => {
    kb.text(`• ${cat.name}`, `category:view:${cat.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (categories.length % 2 !== 0) kb.row();

  kb.text("⬅️ Назад", backCb);
  return kb;
}

export function categoryProductsKeyboard(categories: Category[]) {
  const kb = new InlineKeyboard();
  categories.forEach((cat, index) => {
    kb.text(cat.name, `category:view:${cat.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (categories.length % 2 !== 0) kb.row();
  kb.text("⬅️ Назад", "catalog:start");
  return kb;
}

export function productActionsKeyboard(productId: number) {
  return new InlineKeyboard()
    .text("➕ Добавить в корзину", `product:add:${productId}`)
    .row()
    .text("🛒 Перейти в корзину", "cart:view")
    .row()
    .text("⬅️ Назад", "catalog:start");
}

export function productBackKeyboard(backCb: string) {
  return new InlineKeyboard().text("⬅️ Назад", backCb);
}