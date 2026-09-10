import { BotContext } from "../middleware/auth";
import {
  getCartSummary,
  increaseCartItem,
  decreaseCartItem,
  deleteCartItem,
  clearCart,
} from "../../services/cart.service";
import { getUserByTelegramId } from "../../services/user.service";
import { cartKeyboard } from "../keyboards/cart";
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
  ].join("\n");

  await editText(ctx, text, cartKeyboard(dbUser.id, cart));
}

export async function handleCartInc(ctx: BotContext, cartItemId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  try {
    await increaseCartItem(cartItemId, dbUser.id);
    await handleCartView(ctx);
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
    await handleCartView(ctx);
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