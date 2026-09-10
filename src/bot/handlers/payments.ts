import { BotContext } from "../middleware/auth";
import { getUserByTelegramId } from "../../services/user.service";
import { getState, setState, resetState } from "../../services/state.service";
import { getOrderById, updateOrder, completeReceiptSubmission } from "../../services/order.service";
import { createPaymentRecord } from "../../services/payment.service";
import { uploadFile, validateFileForReceipt } from "../../services/storage.service";
import { notifyAdminsNewOrder } from "../../services/notifications.service";
import { replyText } from "../helpers";
import { userFriendlyError } from "../../utils/errors";
import { ConversationState } from "@prisma/client";
import { getBot } from "../../instance";

export async function processReceiptMessage(ctx: BotContext): Promise<boolean> {
  if (!ctx.state.user || !ctx.from) return false;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return false;

  const state = await getState(dbUser.id);
  if (!state || state.state !== ConversationState.WAITING_RECEIPT) return false;

  const payload: any = state.payload ?? {};
  const orderId = Number(payload.orderId);

  const order = await getOrderById(orderId);
  if (!order || order.userId !== dbUser.id) {
    await resetState(dbUser.id);
    await replyText(ctx, "❌ Заказ не найден. Оформите заказ заново.");
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
    await replyText(ctx, "📎 Отправьте чек об оплате (фото или документ).");
    return true;
  }

  if (!fileId) {
    await replyText(ctx, "❌ Не удалось получить файл. Попробуйте ещё раз.");
    return true;
  }

  // Get file size
  let fileSize = 0;
  try {
    const file = await getBot().api.getFile(fileId);
    fileSize = file.file_size ?? 0;
  } catch (e) {
    await replyText(ctx, "❌ Не удалось получить файл из Telegram.");
    return true;
  }

  const validation = validateFileForReceipt(mimeType, fileName, fileSize);
  if (!validation.ok) {
    await replyText(ctx, userFriendlyError(validation.error));
    return true;
  }

  try {
    const file = await getBot().api.getFile(fileId);
    const buffer: Buffer = await downloadTelegramFile(file.file_path!);
    const { url, key } = await uploadFile(
      `receipts/${order.id}`,
      fileName,
      buffer,
      mimeType ?? "application/octet-stream"
    );

    await updateOrder(order.id, {
      receiptUrl: url,
      receiptFileName: key,
    });

    await createPaymentRecord(order.id, dbUser.id, Number(order.total), url, key);

    const updatedOrder = await getOrderById(order.id);
    await completeReceiptSubmission(order.id);

    await replyText(
      ctx,
      `✅ <b>Чек получен.</b>\n\nВаш заказ №${order.id} отправлен на проверку.`
    );

    await notifyAdminsNewOrder(getBot(), updatedOrder);
    return true;
  } catch (e: any) {
    if (e?.message === "STORAGE_NOT_CONFIGURED") {
      await replyText(ctx, userFriendlyError("STORAGE_NOT_CONFIGURED"));
    } else {
      console.error("Receipt upload failed", e);
      await replyText(ctx, "⚠️ Не удалось сохранить чек. Попробуйте позже.");
    }
    return true;
  }
}

async function downloadTelegramFile(filePath: string): Promise<Buffer> {
  const token = process.env.BOT_TOKEN!;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("DOWNLOAD_FAILED");
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}