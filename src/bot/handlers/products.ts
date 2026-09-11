import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getProductById } from "../../services/product.service";
import { addProductToCart } from "../../services/cart.service";
import { getUserByTelegramId } from "../../services/user.service";
import { renderPhoto, editText, answerAlert } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { userFriendlyError } from "../../utils/errors";

export async function handleProductView(ctx: BotContext, productId: number) {
  if (!ctx.state.user) return;
  const product = await getProductById(productId);

  if (!product || !product.isActive) {
    await answerAlert(ctx, "❌ Товар не найден или недоступен.");
    return;
  }

  const kb = new InlineKeyboard();
  if (product.stock > 0) {
    kb.text("➕ Добавить в корзину", `product:add:${product.id}`);
    kb.row();
  }
  kb.text("🛒 Перейти в корзину", "cart:view");
  kb.row();
  kb.text("⬅️ Назад", `category:view:${product.categoryId}`);

  const text = [
    `💊 <b>${product.name}</b>`,
    ``,
    product.description ?? "",
    ``,
    `💰 Цена: ${formatPrice(Number(product.price))}`,
    product.stock > 0
      ? `📦 В наличии: ${product.stock} шт.`
      : `❌ Товара сейчас нет в наличии`,
  ].join("\n");

  const photo = resolveImageUrl(product.imageUrl);
  if (photo) {
    await renderPhoto(ctx, photo, text, kb);
    return;
  }

  await editText(ctx, text, kb);
}

function resolveImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("tg:")) return imageUrl.slice(3);
  return imageUrl;
}

export async function handleProductAdd(ctx: BotContext, productId: number, quantity = 1) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;

  // Resolve internal user id
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  try {
    await addProductToCart(dbUser.id, productId, quantity);
    await answerAlert(ctx, "✅ Товар добавлен в корзину");
    const msg = ctx.callbackQuery?.message as any;
    if (msg?.caption != null) await ctx.deleteMessage().catch(() => {});
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC"));
  }
}