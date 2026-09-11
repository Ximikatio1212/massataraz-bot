import { BotContext } from "../middleware/auth";
import { getUserByTelegramId } from "../../services/user.service";
import { validateCartForOrder } from "../../services/cart.service";
import { createOrder, updateOrder, getOrderById, completeReceiptSubmission, changeOrderStatus } from "../../services/order.service";
import { setState, getState, resetState } from "../../services/state.service";
import { notifyAdminsNewOrder } from "../../services/notifications.service";
import { getBot } from "../../instance";
import { ConversationState, OrderStatus } from "@prisma/client";
import { cartConfirmKeyboard, checkoutStartKeyboard } from "../keyboards/cart";
import { editHostMessage, answerAlert } from "../helpers";
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
    await editHostMessage(ctx, getHostMessageId(ctx), userFriendlyError(validation.error ?? "GENERIC"));
    return;
  }

  const paymentPhone = process.env.PAYMENT_PHONE ?? "";
  const paymentDetails = process.env.PAYMENT_DETAILS ?? "";
  if (!paymentPhone && !paymentDetails) {
    await editHostMessage(ctx, getHostMessageId(ctx), "⚠️ Реквизиты оплаты не настроены. Обратитесь к администратору.");
    return;
  }

  // Create the order (status: pending_payment)
  let order;
  try {
    order = await createOrder(dbUser.id);
  } catch (e: any) {
    await editHostMessage(ctx, getHostMessageId(ctx), userFriendlyError(e.message ?? "GENERIC"));
    return;
  }

  const hostMessageId = getHostMessageId(ctx);

  await resetState(dbUser.id);
  await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, {
    orderId: order.id,
    hostChatId: Number(ctx.chat?.id),
    hostMessageId,
  });

  const text = [
    `🧾 <b>ЗАКАЗ №${order.id}</b>`,
    ``,
    `💰 К оплате: ${formatPrice(Number(order.total))}`,
    ``,
    `Для оплаты используйте следующие реквизиты:`,
    ``,
    `📱 Номер:\n${paymentPhone}`,
    ``,
    `💳 Реквизиты:\n${paymentDetails}`,
    ``,
    `⬇️ <b>Прикрепите чек</b> или нажмите «Отмена».`,
  ].join("\n");

  await editHostMessage(ctx, hostMessageId, text, checkoutStartKeyboard());
}

export async function handleCheckoutReceipt(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  if (!payload.orderId) {
    await editHostMessage(ctx, getHostMessageId(ctx), "❌ Сессия оформления устарела. Начните заново.", checkoutStartKeyboard());
    return;
  }

  payload.hostMessageId = getHostMessageId(ctx);
  payload.hostChatId = Number(ctx.chat?.id);

  await setState(dbUser.id, ConversationState.WAITING_RECEIPT, payload);
  await editHostMessage(
    ctx,
    getHostMessageId(ctx),
    `📎 Отправьте <b>чек об оплате</b> (фото или документ).\n\nПосле проверки администратором заказ будет обработан.`
  );
}

export async function handleCheckoutData(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  if (!payload.orderId) {
    await editHostMessage(ctx, getHostMessageId(ctx), "❌ Сессия оформления устарела. Начните заново.", checkoutStartKeyboard());
    return;
  }

  payload.hostMessageId = getHostMessageId(ctx);
  payload.hostChatId = Number(ctx.chat?.id);

  await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, payload);
  await editHostMessage(ctx, getHostMessageId(ctx), `📝 Введите <b>ФИО</b>:`);
}

export async function processOrderText(ctx: BotContext, state: any, text: string) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  if (!state) state = {};

  const payload: any = { ...(state.payload ?? {}) };

  const hostMessageId = payload.hostMessageId ?? getHostMessageId(ctx);

  switch (state.state) {
    case ConversationState.WAITING_ORDER_NAME: {
      const v = validateName(text, "ФИО");
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.fullName = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_REGION, payload);
      await editHostMessage(ctx, hostMessageId, `📝 <b>ФИО</b>: ${v.value}\n\n📍 Введите <b>область/регион</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_REGION: {
      const v = validateName(text, "Регион");
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.region = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_CITY, payload);
      await editHostMessage(ctx, hostMessageId, `📍 <b>Регион</b>: ${v.value}\n\n🏙 Введите <b>город</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_CITY: {
      const v = validateName(text, "Город");
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.city = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_ADDRESS, payload);
      await editHostMessage(ctx, hostMessageId, `🏙 <b>Город</b>: ${v.value}\n\n🏠 Введите <b>адрес</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_ADDRESS: {
      const r = addressSchema.safeParse(text.trim());
      if (!r.success) return answerAlert(ctx, r.error.issues[0].message);
      payload.address = r.data;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_PHONE, payload);
      await editHostMessage(ctx, hostMessageId, `🏠 <b>Адрес</b>: ${r.data}\n\n📞 Введите <b>номер телефона</b>:`);
      return;
    }

    case ConversationState.WAITING_ORDER_PHONE: {
      const r = phoneSchema.safeParse(text.trim());
      if (!r.success) return answerAlert(ctx, r.error.issues[0].message);
      payload.phone = r.data;

      const order = await getOrderById(Number(payload.orderId));
      if (!order || order.userId !== dbUser.id) {
        await resetState(dbUser.id);
        await editHostMessage(ctx, hostMessageId, "❌ Заказ не найден. Начните оформление заново.");
        return;
      }

      // Keep state around but mark as review stage
      await setState(dbUser.id, ConversationState.WAITING_ORDER_PHONE, payload);
      await editHostMessage(ctx, hostMessageId, buildOrderSummary(order, payload), cartConfirmKeyboard());
      return;
    }

    case ConversationState.WAITING_RECEIPT:
      await editHostMessage(ctx, hostMessageId, `📎 Отправьте чек об оплате (фото или документ).`);
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
  const hostMessageId = payload.hostMessageId ?? ctx.callbackQuery.message.message_id;

  if (!payload.orderId || !payload.fullName || !payload.phone) {
    await editHostMessage(ctx, hostMessageId, "❌ Сессия оформления устарела. Начните заново.");
    return;
  }

  // Verify the order belongs to this user
  const order = await getOrderById(Number(payload.orderId));
  if (!order || order.userId !== dbUser.id) {
    await resetState(dbUser.id);
    await editHostMessage(ctx, hostMessageId, "❌ Заказ не найден. Начните оформление заново.");
    return;
  }

  // Re-validate cart to ensure products/courses are still available
  const validation = await validateCartForOrder(dbUser.id);
  if (!validation.ok) {
    await resetState(dbUser.id);
    await editHostMessage(ctx, hostMessageId, userFriendlyError(validation.error ?? "GENERIC"));
    return;
  }

  await updateOrder(order.id, {
    fullName: payload.fullName,
    region: payload.region,
    city: payload.city,
    address: payload.address,
    phone: payload.phone,
  });

  const hasReceipt = Boolean(order.receiptFileId || order.receiptUrl);

  // If a receipt was already attached before the data entry, finish the order now
  if (hasReceipt) {
    await completeReceiptSubmission(order.id);
    const updatedOrder = await getOrderById(order.id);
    await notifyAdminsNewOrder(getBot(), updatedOrder);

    await resetState(dbUser.id);
    await editHostMessage(
      ctx,
      hostMessageId,
      `✅ <b>Заказ №${order.id} подтверждён.</b>\n\nЧек получен, данные доставки сохранены.\n\nЗаказ отправлен на проверку.`
    );
    return;
  }

  await setState(dbUser.id, ConversationState.WAITING_RECEIPT, {
    orderId: order.id,
    hostChatId: payload.hostChatId,
    hostMessageId,
  });

  await editHostMessage(
    ctx,
    hostMessageId,
    `✅ Данные сохранены.\n\n📎 <b>Отправьте чек об оплате.</b>\n\nПосле проверки администратором заказ будет обработан.`
  );
}

export async function handleCheckoutCancel(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  const hostMessageId = payload.hostMessageId ?? getHostMessageId(ctx);

  // If the order exists and is still pending, cancel it fully
  if (payload.orderId) {
    try {
      const order = await getOrderById(Number(payload.orderId));
      if (
        order &&
        (order.status === OrderStatus.pending_payment ||
          order.status === OrderStatus.pending_verification)
      ) {
        await changeOrderStatus(Number(payload.orderId), OrderStatus.cancelled);
      }
    } catch (e) {
      // non-fatal
    }
  }

  await resetState(dbUser.id);
  await editHostMessage(ctx, hostMessageId, "❌ Оформление отменено.");
}

export async function handleCheckoutEdit(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = { ...((state?.payload ?? {}) as any) };
  const orderId = payload.orderId;
  const clean: any = { orderId };
  if (payload.hostChatId) clean.hostChatId = payload.hostChatId;
  if (payload.hostMessageId) clean.hostMessageId = payload.hostMessageId;

  const hostMessageId = payload.hostMessageId ?? getHostMessageId(ctx);

  await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, clean);
  await editHostMessage(ctx, hostMessageId, `📝 Введите <b>ФИО</b> заново:`);
}

function getHostMessageId(ctx: BotContext): number | undefined {
  return ctx.callbackQuery?.message?.message_id ?? ctx.message?.message_id ?? undefined;
}