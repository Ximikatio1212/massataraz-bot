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
import { validateName, validatePhone, validateAddress } from "../../utils/validation";
import { t } from "../../i18n";

export async function handleCheckoutStart(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const validation = await validateCartForOrder(dbUser.id);
  if (!validation.ok) {
    await editHostMessage(ctx, getHostMessageId(ctx), userFriendlyError(validation.error ?? "GENERIC", lang));
    return;
  }

  const paymentPhone = process.env.PAYMENT_PHONE ?? "";
  const paymentDetails = process.env.PAYMENT_DETAILS ?? "";
  if (!paymentPhone && !paymentDetails) {
    await editHostMessage(ctx, getHostMessageId(ctx), t(lang, "pay_not_configured"));
    return;
  }

  // Create the order (status: pending_payment)
  let order;
  try {
    order = await createOrder(dbUser.id);
  } catch (e: any) {
    await editHostMessage(ctx, getHostMessageId(ctx), userFriendlyError(e.message ?? "GENERIC", lang));
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
    t(lang, "order_no", { id: order.id }),
    ``,
    t(lang, "pay_amount", { total: formatPrice(Number(order.total)) }),
    ``,
    t(lang, "pay_requisites_title"),
    ``,
    `${t(lang, "pay_number")}\n${paymentPhone}`,
    ``,
    `${t(lang, "pay_details")}\n${paymentDetails}`,
    ``,
    t(lang, "attach_check"),
  ].join("\n");

  await editHostMessage(ctx, hostMessageId, text, checkoutStartKeyboard(lang));
}

export async function handleCheckoutReceipt(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  if (!payload.orderId) {
    await editHostMessage(ctx, getHostMessageId(ctx), t(lang, "session_expired"), checkoutStartKeyboard(lang));
    return;
  }

  payload.hostMessageId = getHostMessageId(ctx);
  payload.hostChatId = Number(ctx.chat?.id);

  await setState(dbUser.id, ConversationState.WAITING_RECEIPT, payload);
  await editHostMessage(ctx, getHostMessageId(ctx), t(lang, "send_receipt"));
}

export async function handleCheckoutData(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  if (!payload.orderId) {
    await editHostMessage(ctx, getHostMessageId(ctx), t(lang, "session_expired"), checkoutStartKeyboard(lang));
    return;
  }

  payload.hostMessageId = getHostMessageId(ctx);
  payload.hostChatId = Number(ctx.chat?.id);

  await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, payload);
  await editHostMessage(ctx, getHostMessageId(ctx), t(lang, "enter_fio"));
}

export async function processOrderText(ctx: BotContext, state: any, text: string) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  if (!state) state = {};
  const lang = dbUser.lang ?? "ru";

  const payload: any = { ...(state.payload ?? {}) };

  const hostMessageId = payload.hostMessageId ?? getHostMessageId(ctx);

  switch (state.state) {
    case ConversationState.WAITING_ORDER_NAME: {
      const v = validateName(text, t(lang, "field_fio"), lang);
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.fullName = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_REGION, payload);
      await editHostMessage(ctx, hostMessageId, `${t(lang, "fio_set", { v: v.value })}\n\n${t(lang, "enter_region")}`);
      return;
    }

    case ConversationState.WAITING_ORDER_REGION: {
      const v = validateName(text, t(lang, "field_region"), lang);
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.region = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_CITY, payload);
      await editHostMessage(ctx, hostMessageId, `${t(lang, "region_set", { v: v.value })}\n\n${t(lang, "enter_city")}`);
      return;
    }

    case ConversationState.WAITING_ORDER_CITY: {
      const v = validateName(text, t(lang, "field_city"), lang);
      if (!v.ok) return answerAlert(ctx, v.error);
      payload.city = v.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_ADDRESS, payload);
      await editHostMessage(ctx, hostMessageId, `${t(lang, "city_set", { v: v.value })}\n\n${t(lang, "enter_address")}`);
      return;
    }

    case ConversationState.WAITING_ORDER_ADDRESS: {
      const r = validateAddress(text, lang);
      if (!r.ok) return answerAlert(ctx, r.error);
      payload.address = r.value;
      await setState(dbUser.id, ConversationState.WAITING_ORDER_PHONE, payload);
      await editHostMessage(ctx, hostMessageId, `${t(lang, "address_set", { v: r.value })}\n\n${t(lang, "enter_phone")}`);
      return;
    }

    case ConversationState.WAITING_ORDER_PHONE: {
      const r = validatePhone(text, lang);
      if (!r.ok) return answerAlert(ctx, r.error);
      payload.phone = r.value;

      const order = await getOrderById(Number(payload.orderId));
      if (!order || order.userId !== dbUser.id) {
        await resetState(dbUser.id);
        await editHostMessage(ctx, hostMessageId, t(lang, "order_not_found_restart"));
        return;
      }

      // Keep state around but mark as review stage
      await setState(dbUser.id, ConversationState.WAITING_ORDER_PHONE, payload);
      await editHostMessage(ctx, hostMessageId, buildOrderSummary(order, payload, lang), cartConfirmKeyboard(lang));
      return;
    }

    case ConversationState.WAITING_RECEIPT:
      await editHostMessage(ctx, hostMessageId, t(lang, "send_receipt_short"));
      return;

    default:
      return;
  }
}

function buildOrderSummary(order: any, info: any, lang: string) {
  const items = order.items
    .map((i: any) => `• ${i.productName} × ${i.quantity}`)
    .join("\n");

  return [
    t(lang, "check_order"),
    ``,
    `${t(lang, "label_fio")}\n${info.fullName}`,
    ``,
    `${t(lang, "label_region")}\n${info.region}`,
    ``,
    `${t(lang, "label_city")}\n${info.city}`,
    ``,
    `${t(lang, "label_addr")}\n${info.address}`,
    ``,
    `${t(lang, "label_phone")}\n${info.phone}`,
    ``,
    `${t(lang, "summary_items")}\n${items}`,
    ``,
    t(lang, "summary_sum", { total: formatPrice(Number(order.total)) }),
  ].join("\n");
}

export async function handleCheckoutConfirm(ctx: BotContext) {
  if (!ctx.state.user || !ctx.callbackQuery?.message) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  const hostMessageId = payload.hostMessageId ?? ctx.callbackQuery.message.message_id;

  if (!payload.orderId || !payload.fullName || !payload.phone) {
    await editHostMessage(ctx, hostMessageId, t(lang, "session_expired"));
    return;
  }

  // Verify the order belongs to this user
  const order = await getOrderById(Number(payload.orderId));
  if (!order || order.userId !== dbUser.id) {
    await resetState(dbUser.id);
    await editHostMessage(ctx, hostMessageId, t(lang, "order_not_found_restart"));
    return;
  }

  // Re-validate cart to ensure products/courses are still available
  const validation = await validateCartForOrder(dbUser.id);
  if (!validation.ok) {
    await resetState(dbUser.id);
    await editHostMessage(ctx, hostMessageId, userFriendlyError(validation.error ?? "GENERIC", lang));
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
      t(lang, "order_confirmed", { id: order.id })
    );
    return;
  }

  await setState(dbUser.id, ConversationState.WAITING_RECEIPT, {
    orderId: order.id,
    hostChatId: payload.hostChatId,
    hostMessageId,
  });

  await editHostMessage(ctx, hostMessageId, t(lang, "data_saved_send_check"));
}

export async function handleCheckoutCancel(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

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
  await editHostMessage(ctx, hostMessageId, t(lang, "checkout_cancelled"));
}

export async function handleCheckoutEdit(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const state = await getState(dbUser.id);
  const payload: any = { ...((state?.payload ?? {}) as any) };
  const orderId = payload.orderId;
  const clean: any = { orderId };
  if (payload.hostChatId) clean.hostChatId = payload.hostChatId;
  if (payload.hostMessageId) clean.hostMessageId = payload.hostMessageId;

  const hostMessageId = payload.hostMessageId ?? getHostMessageId(ctx);

  await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, clean);
  await editHostMessage(ctx, hostMessageId, t(lang, "enter_fio_again"));
}

function getHostMessageId(ctx: BotContext): number | undefined {
  return ctx.callbackQuery?.message?.message_id ?? ctx.message?.message_id ?? undefined;
}