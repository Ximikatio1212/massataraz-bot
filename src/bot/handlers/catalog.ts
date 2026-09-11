import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getActiveCategories } from "../../services/category.service";
import { getActiveProductsByCategory } from "../../services/product.service";
import { getUserByTelegramId } from "../../services/user.service";
import { categoriesKeyboard } from "../keyboards/catalog";
import { editText } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { t } from "../../i18n";

export async function handleCatalogStart(ctx: BotContext) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const categories = await getActiveCategories();

  if (categories.length === 0) {
    await editText(ctx, t(lang, "catalog_empty"));
    return;
  }

  const text = t(lang, "catalog_title");
  await editText(ctx, text, categoriesKeyboard(categories, "main:menu", lang));
}

export async function handleCategoryView(ctx: BotContext, categoryId: number) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const products = await getActiveProductsByCategory(categoryId);

  if (products.length === 0) {
    await editText(ctx, t(lang, "category_empty"), categoriesKeyboard([], "catalog:start", lang));
    return;
  }

  const list = products
    .map(
      (p) =>
        `💊 <b>${p.name}</b>\n💰 ${formatPrice(Number(p.price))}${
          p.stock > 0 ? `\n${t(lang, "in_stock", { n: p.stock })}` : `\n${t(lang, "no_stock")}`
        }`
    )
    .join("\n\n");

  const text = `${t(lang, "category_label")}\n\n${list}\n\n<b>${t(lang, "choose_product")}</b>`;
  await editText(ctx, text, productListKeyboard(products, lang));
}

function productListKeyboard(products: { id: number; name: string; stock: number }[], lang?: string) {
  const kb = new InlineKeyboard();
  products.forEach((p) => {
    kb.text(
      `${p.stock > 0 ? "✅" : "❌"} ${p.name.length > 25 ? p.name.slice(0, 25) + "…" : p.name}`,
      `product:view:${p.id}`
    );
    kb.row();
  });
  kb.text(t(lang, "btn_back"), "catalog:start");
  return kb;
}