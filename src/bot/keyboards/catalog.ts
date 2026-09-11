import { InlineKeyboard } from "grammy";
import { Category } from "@prisma/client";
import { t } from "../../i18n";

export function categoriesKeyboard(categories: Category[], backCb = "main:menu", lang?: string) {
  const kb = new InlineKeyboard();

  categories.forEach((cat, index) => {
    kb.text(`• ${cat.name}`, `category:view:${cat.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (categories.length % 2 !== 0) kb.row();

  kb.text(t(lang, "btn_back"), backCb);
  return kb;
}

export function categoryProductsKeyboard(categories: Category[], lang?: string) {
  const kb = new InlineKeyboard();
  categories.forEach((cat, index) => {
    kb.text(cat.name, `category:view:${cat.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (categories.length % 2 !== 0) kb.row();
  kb.text(t(lang, "btn_back"), "catalog:start");
  return kb;
}

export function productActionsKeyboard(productId: number, lang?: string) {
  const kb = new InlineKeyboard()
    .text(t(lang, "btn_add_cart"), `product:add:${productId}`)
    .row()
    .text(t(lang, "btn_go_cart"), "cart:view")
    .row();
  return kb;
}

export function productBackKeyboard(backCb: string, lang?: string) {
  return new InlineKeyboard().text(t(lang, "btn_back"), backCb);
}