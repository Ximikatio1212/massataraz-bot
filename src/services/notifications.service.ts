import { Bot, InlineKeyboard } from "grammy";
import { formatPrice } from "../utils/formatting";

function getAdminIds(): bigint[] {
  const raw = process.env.ADMIN_IDS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return BigInt(s);
      } catch {
        return null;
      }
    })
    .filter((x): x is bigint => x !== null);
}

function buildOrderText(order: any): string {
  const items = order.items
    .map((i: any) => `• ${i.productName} × ${i.quantity}`)
    .join("\n");

  const address = [order.region, order.city, order.address].filter(Boolean).join(", ");
  const postal = order.postalCode ? `\n🔢 <b>Индекс:</b>\n${order.postalCode}` : "";

  return [
    `🔔 <b>НОВЫЙ ЗАКАЗ #${order.id}</b>`,
    ``,
    `👤 <b>Клиент:</b>\n${order.fullName ?? "-"}`,
    ``,
    `📞 <b>Телефон:</b>\n${order.phone ?? "-"}`,
    ``,
    `📍 <b>Адрес:</b>\n${address || "-"}${postal}`,
    ``,
    `🛍 <b>Состав:</b>\n${items}`,
    ``,
    `💰 <b>Сумма:</b>\n${formatPrice(Number(order.total))}`,
    ``,
    `💳 <b>Оплата:</b>\nОжидает проверки`,
    ``,
    `📎 Чек прикреплён`,
  ].join("\n");
}

function buildOrderKeyboard(order: any): InlineKeyboard {
  const kb = new InlineKeyboard();
  if (order.receiptUrl) {
    kb.url("📎 Открыть чек", order.receiptUrl);
    kb.row();
  }
  kb.text("✅ Подтвердить оплату", `admin:payment:confirm:${order.id}`);
  kb.row();
  kb.text("❌ Отклонить оплату", `admin:payment:reject:${order.id}`);
  return kb;
}

async function sendOrderToAdmin(bot: Bot<any>, adminId: bigint, order: any) {
  const text = buildOrderText(order);
  const kb = buildOrderKeyboard(order);
  const api = bot.api;

  const send = (method: "sendPhoto" | "sendDocument"): Promise<unknown> =>
    method === "sendPhoto"
      ? (api.sendPhoto(adminId.toString(), order.receiptFileId, {
          caption: text,
          parse_mode: "HTML",
          reply_markup: kb,
        }) as unknown as Promise<unknown>)
      : (api.sendDocument(adminId.toString(), order.receiptFileId, {
          caption: text,
          parse_mode: "HTML",
          reply_markup: kb,
        }) as unknown as Promise<unknown>);

  try {
    if (order.receiptFileId) {
      // Always try sendPhoto first if the mime suggests an image.
      if ((order.receiptMimeType ?? "").startsWith("image/")) {
        await send("sendPhoto").catch(() => send("sendDocument"));
      } else {
        await send("sendDocument");
      }
      return;
    }
    await bot.api.sendMessage(adminId.toString(), text, {
      parse_mode: "HTML",
      reply_markup: kb,
    });
  } catch (e) {
    console.error("failed to notify admin", adminId.toString(), e);
  }
}

export async function notifyAdminsNewOrder(bot: Bot<any>, order: any) {
  const adminIds = getAdminIds();
  for (const adminId of adminIds) {
    await sendOrderToAdmin(bot, adminId, order);
  }
}

export async function notifyAdminOrderPaid(bot: Bot<any>, order: any) {
  const adminIds = getAdminIds();
  const text = `✅ Оплата заказа #${order.id} подтверждена. Заказ принят в обработку.`;

  for (const adminId of adminIds) {
    await bot.api
      .sendMessage(adminId.toString(), text)
      .catch((e) => console.error("failed to notify admin", adminId.toString(), e));
  }
}

export async function notifyAdminOrderRejected(bot: Bot<any>, order: any, reason: string) {
  const adminIds = getAdminIds();
  const text = `❌ Оплата заказа #${order.id} отклонена.\n\nПричина: ${reason}`;

  for (const adminId of adminIds) {
    await bot.api
      .sendMessage(adminId.toString(), text)
      .catch((e) => console.error("failed to notify admin", adminId.toString(), e));
  }
}