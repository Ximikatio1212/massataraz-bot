import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getProductById } from "../../services/product.service";
import { addProductToCart } from "../../services/cart.service";
import { getUserByTelegramId } from "../../services/user.service";
import { renderPhoto, editText, answerAlert } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { userFriendlyError } from "../../utils/errors";
import { t } from "../../i18n";

export async function handleProductView(ctx: BotContext, productId: number) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const product = await getProductById(productId);

  if (!product || !product.isActive) {
    await answerAlert(ctx, t(lang, "product_not_found"));
    return;
  }

  const kb = new InlineKeyboard();
  if (product.stock > 0) {
    kb.text(t(lang, "btn_add_cart"), `product:add:${product.id}`);
    kb.row();
  }
  kb.text(t(lang, "btn_go_cart"), "cart:view");
  kb.row();
  kb.text(t(lang, "btn_back"), `category:view:${product.categoryId}`);

  const text = [
    `💊 <b>${product.name}</b>`,
    ``,
    product.description ?? "",
    ``,
    t(lang, "price_label", { price: formatPrice(Number(product.price)) }),
    product.stock > 0
      ? t(lang, "in_stock", { n: product.stock })
      : t(lang, "product_no_stock"),
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
  const lang = dbUser.lang ?? "ru";

  try {
    await addProductToCart(dbUser.id, productId, quantity);
    // Сразу показываем корзину надёжным рендером (webhook reply) — не полагаемся
    // на исходящий answerCallbackQuery/deleteMessage, которые на cmh молча падают.
    const { handleCartView } = await import("./cart");
    await handleCartView(ctx);
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC", lang));
  }
}