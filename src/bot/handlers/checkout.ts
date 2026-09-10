import { BotContext } from "../middleware/auth";
import { getUserByTelegramId } from "../../services/user.service";
import { validateCartForOrder } from "../../services/cart.service";
import { createOrder, updateOrder, getOrderById } from "../../services/order.service";
import { setState, getState, resetState } from "../../services/state.service";
import { ConversationState } from "@prisma/client";
import { cartConfirmKeyboard } from "../keyboards/cart";
import { editText, replyText, answerAlert } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { userFriendlyError } from "../../utils/errors";
import { validateName, phoneSchema, addressSchema } from "../../utils/validation";

export async function handleCheckoutStart(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const validation = await validateCartForOrder(dbUser.id);
  if (!validation.ok) {
    await editText(ctx, userFriendlyError(validation.error ?? "GENERIC"));
    return;
  }

  const paymentPhone = process.env.PAYMENT_PHONE ?? "";
  const paymentDetails = process.env.PAYMENT_DETAILS ?? "";
  if (!paymentPhone && !paymentDetails) {
    await editText(ctx, "⚠️ Реквизиты оплаты не настроены. Обратитесь к администратору.");
    return;
  }

  // Create the order (status: pending_payment)
  let order;
  try {
    order = await createOrder(dbUser.id);
  } catch (e: any) {
    await editText(ctx, userFriendlyError(e.message ?? "GENERIC"));
    return;
  }

  await resetState(dbUser.id);
  await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, { orderId: order.id });

  await editText(
    ctx,
    [
      `🧾 <b>ЗАКАЗ №${order.id}</b>`,
      ``,
      `💰 К оплате: ${formatPrice(Number(order.total))}`,
      ``,
      `Для оплаты используйте следующие реквизиты:`,
      ``,
      `📱 Номер:\n${paymentPhone}`,
      ``,
      `💳 Реквизиты:\n${paymentDetails}`,
    ].join("\n")
  );

  await replyText(ctx, `📝 После оплаты введите <b>ФИО</b>:`);
}

export async function processOrderText(ctx: BotContext, state: any, text: string) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  if (!state) state = {};

  const payload = { ...state };
  delete payload.state;
  delete payload.userId;
  delete payload.updatedAt;

  switch (state.state) {
    case ConversationState.WAITING_ORDER_NAME: {
      const v = validateName(text, "ФИО");
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.fullName = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_REGION, payload);
      await replyText(ctx, `📍 Введите <b>область/регион</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_REGION: {
      const v = validateName(text, "Регион");
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.region = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_CITY, payload);
      await replyText(ctx, `🏙 Введите <b>город</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_CITY: {
      const v = validateName(text, "Город");
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.city = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_ADDRESS, payload);
      await replyText(ctx, `🏠 Введите <b>адрес</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_ADDRESS: {
      const r = addressSchema.safeParse(text.trim());
      if (!r.success) return answerAlert(ctx, r.error.issues[0].message);
      payload.address = r.data;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_PHONE, payload);
      await replyText(ctx, `📞 Введите <b>номер телефона</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_PHONE: {
      const r = phoneSchema.safeParse(text.trim());
      if (!r.success) return answerAlert(ctx, r.error.issues[0].message);
      payload.phone = r.data;

      const order = await getOrderById(Number(payload.orderId));
      if (!order || order.userId !== dbUser.id) {
        await resetState(dbUser.id);
        await replyText(ctx, "❌ Заказ не найден. Начните оформление заново.");
        return;
      }

      // Keep state around but mark as review stage
      await setState(dbUser.id, ConversationState.WAITING_ORDER_PHONE, payload);
      await replyText(ctx, buildOrderSummary(order, payload), cartConfirmKeyboard());
      return;
    }

    case ConversationState.WAITING_RECEIPT:
      await replyText(ctx, `📎 Отправьте чек об оплате (фото или документ).`);
      return;

    default:
      return;
  }
}

function buildOrderSummary(order: any, info: any) {
  const items = order.items
    .map((i: any) => `• ${i.productName} × ${i.quantity}`)
    .join("\n");

  return [
    `📦 <b>ПРОВЕРКА ЗАКАЗА</b>`,
    ``,
    `👤 <b>ФИО</b>\n${info.fullName}`,
    ``,
    `📍 <b>Регион</b>\n${info.region}`,
    ``,
    `🏙 <b>Город</b>\n${info.city}`,
    ``,
    `🏠 <b>Адрес</b>\n${info.address}`,
    ``,
    `📞 <b>Телефон</b>\n${info.phone}`,
    ``,
    `🛍 <b>Товары:</b>\n${items}`,
    ``,
    `💰 <b>Сумма: ${formatPrice(Number(order.total))}</b>`,
  ].join("\n");
}

export async function handleCheckoutConfirm(ctx: BotContext) {
  if (!ctx.state.user || !ctx.callbackQuery?.message) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};

  if (!payload.orderId || !payload.fullName || !payload.phone) {
    await editText(ctx, "❌ Сессия оформления устарела. Начните заново.");
    return;
  }

  // Verify the order belongs to this user
  const order = await getOrderById(Number(payload.orderId));
  if (!order || order.userId !== dbUser.id) {
    await resetState(dbUser.id);
    await editText(ctx, "❌ Заказ не найден. Начните оформление заново.");
    return;
  }

  // Re-validate cart to ensure products/courses are still available
  const validation = await validateCartForOrder(dbUser.id);
  if (!validation.ok) {
    await resetState(dbUser.id);
    await editText(ctx, userFriendlyError(validation.error ?? "GENERIC"));
    return;
  }

  await updateOrder(order.id, {
    fullName: payload.fullName,
    region: payload.region,
    city: payload.city,
    address: payload.address,
    phone: payload.phone,
  });

  await setState(dbUser.id, ConversationState.WAITING_RECEIPT, { orderId: order.id });

  await editText(ctx, `✅ Данные сохранены.`);
  await replyText(
    ctx,
    `📎 <b>Отправьте чек об оплате.</b>\n\nПосле проверки администратором заказ будет обработан.`
  );
}

export async function handleCheckoutCancel(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  await resetState(dbUser.id);
  await editText(ctx, "❌ Оформление отменено.");
}

export async function handleCheckoutEdit(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = { ...(state?.payload ?? {}) };
  const orderId = payload.orderId;
  const clean = { orderId };

  await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, clean);
  await replyText(ctx, `📝 Введите <b>ФИО</b> заново:`);
}