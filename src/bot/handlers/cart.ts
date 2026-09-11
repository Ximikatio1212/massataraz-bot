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
import { editText, answerAlert } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { userFriendlyError } from "../../utils/errors";

export async function handleCartView(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const cart = await getCartSummary(dbUser.id);

  if (cart.items.length === 0) {
    await editText(ctx, "🛒 <b>КОРЗИНА</b>\n\nВаша корзина пуста.");
    return;
  }

  const lines = cart.items.map((i) => {
    const icon = i.type === "course" ? "📚" : "💊";
    return `${icon} <b>${i.name}</b>\n${i.quantity} × ${formatPrice(i.price)} = ${formatPrice(i.subtotal)}`;
  });

  const text = [
    `🛒 <b>КОРЗИНА</b>`,
    ``,
    ...lines,
    ``,
    `───────────────`,
    ``,
    `💰 <b>Итого: ${formatPrice(cart.total)}</b>`,
    ``,
    `Нажмите на товар, чтобы изменить количество.`,
  ].join("\n");

  await editText(ctx, text, cartKeyboard(dbUser.id, cart));
}

export async function handleCartItemView(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const items = await getCart(dbUser.id);
  const raw = items.find((i) => i.id === cartItemId);
  if (!raw) {
    await answerAlert(ctx, "❌ Позиция не найдена.");
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
    `💰 Цена: ${formatPrice(price)} × ${qty} = <b>${formatPrice(subtotal)}</b>`,
    stock !== null ? `📦 В наличии: ${stock} шт` : `📦 Состав курса`,
    ``,
    `Количество: <b>${qty}</b>`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  await editText(ctx, text, cartItemKeyboard(cartItemId));
}

export async function handleCartInc(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  try {
    await increaseCartItem(cartItemId, dbUser.id);
    await handleCartItemView(ctx, cartItemId);
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC"));
  }
}

export async function handleCartDec(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  try {
    await decreaseCartItem(cartItemId, dbUser.id);
    // decreaseCartItem deletes the item when quantity hits 0 -> return to cart
    const items = await getCart(dbUser.id);
    const stillExists = items.some((i) => i.id === cartItemId);
    if (!stillExists) return handleCartView(ctx);
    await handleCartItemView(ctx, cartItemId);
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC"));
  }
}

export async function handleCartDel(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  try {
    await deleteCartItem(cartItemId, dbUser.id);
    await handleCartView(ctx);
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC"));
  }
}

export async function handleCartClear(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  await clearCart(dbUser.id);
  await editText(ctx, "🧹 Корзина очищена.");
}