import { BotContext } from "../middleware/auth";
import {
  getCart,
  getCartSummary,
  increaseCartItem,
  decreaseCartItem,
  deleteCartItem,
  clearCart,
} from "../../services/cart.service";
import { getUserByTelegramId } from "../../services/user.service";
import { cartKeyboard, cartItemKeyboard } from "../keyboards/cart";
import { editText, answerAlert, backToMenuKb } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { userFriendlyError } from "../../utils/errors";
import { t } from "../../i18n";

export async function handleCartView(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const cart = await getCartSummary(dbUser.id);

  if (cart.items.length === 0) {
    await editText(ctx, t(lang, "cart_empty"), backToMenuKb(lang));
    return;
  }

  const lines = cart.items.map((i) => {
    const icon = i.type === "course" ? "📚" : "💊";
    return `${icon} <b>${i.name}</b>\n${i.quantity} × ${formatPrice(i.price)} = ${formatPrice(i.subtotal)}`;
  });

  const text = [
    t(lang, "cart_title"),
    ``,
    ...lines,
    ``,
    `───────────────`,
    ``,
    t(lang, "cart_total", { total: formatPrice(cart.total) }),
    ``,
    t(lang, "cart_hint"),
  ].join("\n");

  await editText(ctx, text, cartKeyboard(dbUser.id, cart, lang));
}

export async function handleCartItemView(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const items = await getCart(dbUser.id);
  const raw = items.find((i) => i.id === cartItemId);
  if (!raw) {
    await answerAlert(ctx, t(lang, "item_not_found"));
    return handleCartView(ctx);
  }

  const icon = raw.type === "course" ? "📚" : "💊";
  const name = raw.course?.name ?? raw.product?.name ?? "Товар";
  const price = Number(raw.course?.price ?? raw.product?.price ?? 0);
  const qty = raw.quantity;
  const subtotal = price * qty;
  const stock = raw.product ? raw.product.stock : null;

  const text = [
    `${icon} <b>${name}</b>`,
    ``,
    t(lang, "item_price_subtotal", { price: formatPrice(price), qty, subtotal: formatPrice(subtotal) }),
    stock !== null ? t(lang, "item_in_stock", { n: stock }) : t(lang, "item_course_comp"),
    ``,
    t(lang, "item_qty", { qty }),
  ]
    .filter((l) => l !== null)
    .join("\n");

  await editText(ctx, text, cartItemKeyboard(cartItemId, lang));
}

export async function handleCartInc(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  try {
    await increaseCartItem(cartItemId, dbUser.id);
    await handleCartItemView(ctx, cartItemId);
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC", lang));
  }
}

export async function handleCartDec(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  try {
    await decreaseCartItem(cartItemId, dbUser.id);
    // decreaseCartItem deletes the item when quantity hits 0 -> return to cart
    const items = await getCart(dbUser.id);
    const stillExists = items.some((i) => i.id === cartItemId);
    if (!stillExists) return handleCartView(ctx);
    await handleCartItemView(ctx, cartItemId);
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC", lang));
  }
}

export async function handleCartDel(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  try {
    await deleteCartItem(cartItemId, dbUser.id);
    await handleCartView(ctx);
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC", lang));
  }
}

export async function handleCartClear(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  await clearCart(dbUser.id);
  // Рендерим пустую корзину с кнопкой «Главное меню», чтобы кнопка
  // «Очистить корзину» не уводила экран в тупик без клавиатуры.
  await handleCartView(ctx);
}