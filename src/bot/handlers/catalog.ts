import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getActiveCategories } from "../../services/category.service";
import { getActiveProductsByCategory } from "../../services/product.service";
import { categoriesKeyboard } from "../keyboards/catalog";
import { editText } from "../helpers";
import { formatPrice } from "../../utils/formatting";

export async function handleCatalogStart(ctx: BotContext) {
  if (!ctx.state.user) return;
  const categories = await getActiveCategories();

  if (categories.length === 0) {
    await editText(ctx, "🛍 <b>СПОРТИВНОЕ ПИТАНИЕ</b>\n\nПока нет доступных категорий.");
    return;
  }

  const text = "🛍 <b>СПОРТИВНОЕ ПИТАНИЕ</b>\n\nВыберите категорию:";
  await editText(ctx, text, categoriesKeyboard(categories, "main:menu"));
}

export async function handleCategoryView(ctx: BotContext, categoryId: number) {
  if (!ctx.state.user) return;
  const products = await getActiveProductsByCategory(categoryId);

  if (products.length === 0) {
    await editText(ctx, "🛍 В этой категории пока нет товаров.", categoriesKeyboard([], "catalog:start"));
    return;
  }

  const list = products
    .map(
      (p) =>
        `💊 <b>${p.name}</b>\n💰 ${formatPrice(Number(p.price))}${
          p.stock > 0 ? `\n📦 В наличии: ${p.stock} шт.` : "\n❌ Нет в наличии"
        }`
    )
    .join("\n\n");

  const text = `📁 <b>Категория</b>\n\n${list}\n\n<b>Выберите товар:</b>`;
  await editText(ctx, text, productListKeyboard(products));
}

function productListKeyboard(products: { id: number; name: string; stock: number }[]) {
  const kb = new InlineKeyboard();
  products.forEach((p) => {
    kb.text(
      `${p.stock > 0 ? "✅" : "❌"} ${p.name.length > 25 ? p.name.slice(0, 25) + "…" : p.name}`,
      `product:view:${p.id}`
    );
    kb.row();
  });
  kb.text("⬅️ Назад", "catalog:start");
  return kb;
}