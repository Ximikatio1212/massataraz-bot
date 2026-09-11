import { BotContext } from "../middleware/auth";
import { getUserByTelegramId } from "../../services/user.service";
import { getState, setState, resetState } from "../../services/state.service";
import { getOrderById, updateOrder, completeReceiptSubmission } from "../../services/order.service";
import { createPaymentRecord } from "../../services/payment.service";
import { validateFileForReceipt } from "../../services/storage.service";
import { notifyAdminsNewOrder } from "../../services/notifications.service";
import { editHostMessage, replyText } from "../helpers";
import { userFriendlyError } from "../../utils/errors";
import { ConversationState } from "@prisma/client";
import { getBot } from "../../instance";
import { t } from "../../i18n";

export async function processReceiptMessage(ctx: BotContext): Promise<boolean> {
  if (!ctx.state.user || !ctx.from) return false;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return false;
  const lang = dbUser.lang ?? "ru";

  const state = await getState(dbUser.id);
  if (!state || state.state !== ConversationState.WAITING_RECEIPT) return false;

  const payload: any = state.payload ?? {};
  const orderId = Number(payload.orderId);
  const hostMessageId = payload.hostMessageId ?? ctx.message?.message_id ?? undefined;

  const order = await getOrderById(orderId);
  if (!order || order.userId !== dbUser.id) {
    await resetState(dbUser.id);
    await editHostMessage(ctx, hostMessageId, t(lang, "receipt_order_not_found"));
    return true;
  }

  // Extract file info
  let fileId: string | undefined;
  let fileName = `receipt_${order.id}`;
  let mimeType: string | undefined;

  if (ctx.message?.photo) {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    fileId = photo.file_id;
    mimeType = "image/jpeg";
    fileName = `receipt_${order.id}.jpg`;
  } else if (ctx.message?.document) {
    const doc = ctx.message.document;
    fileId = doc.file_id;
    mimeType = doc.mime_type;
    fileName = doc.file_name ?? `receipt_${order.id}`;
    const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!["jpg", "jpeg", "png", "webp", "heic", "pdf"].includes(ext)) {
      fileName = `${fileName}.${mimeType === "application/pdf" ? "pdf" : "img"}`;
    }
  } else {
    await editHostMessage(ctx, hostMessageId, t(lang, "send_receipt_short"));
    return true;
  }

  if (!fileId) {
    await editHostMessage(ctx, hostMessageId, t(lang, "file_fail"));
    return true;
  }

  // Get file size
  let fileSize = 0;
  try {
    const file = await getBot().api.getFile(fileId);
    fileSize = file.file_size ?? 0;
  } catch (e) {
    await editHostMessage(ctx, hostMessageId, t(lang, "file_tg_fail"));
    return true;
  }

  const validation = validateFileForReceipt(mimeType, fileName, fileSize);
  if (!validation.ok) {
    await editHostMessage(ctx, hostMessageId, userFriendlyError(validation.error, lang));
    return true;
  }

  try {
    await updateOrder(order.id, {
      receiptUrl: undefined,
      receiptFileName: fileName,
      receiptFileId: fileId,
      receiptMimeType: mimeType ?? undefined,
    });

    await createPaymentRecord(order.id, dbUser.id, Number(order.total), undefined, fileName, fileId, mimeType);

    // If delivery data has not been entered yet, keep the order open for data entry
    if (!order.fullName || !order.phone) {
      await setState(dbUser.id, ConversationState.WAITING_ORDER_NAME, {
        orderId: order.id,
        hostChatId: Number(ctx.chat?.id),
        hostMessageId,
      });
      await editHostMessage(
        ctx,
        hostMessageId,
        t(lang, "check_received_name", { id: order.id })
      );
      return true;
    }

    await completeReceiptSubmission(order.id);
    const updatedOrder = await getOrderById(order.id);

    await editHostMessage(
      ctx,
      hostMessageId,
      t(lang, "check_received", { id: order.id })
    );

    await notifyAdminsNewOrder(getBot(), updatedOrder);
    return true;
  } catch (e: any) {
    console.error("Receipt upload failed", e);
    await editHostMessage(ctx, hostMessageId, t(lang, "save_failed"));
    return true;
  }
}