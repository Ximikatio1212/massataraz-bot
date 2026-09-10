import { Bot, Context, InlineKeyboard } from "grammy";
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

export async function notifyAdminsNewOrder(bot: Bot<any>, order: any) {
  const adminIds = getAdminIds();

  const items = order.items
    .map((i: any) => `• ${i.productName} × ${i.quantity}`)
    .join("\n");

  const address = [order.region, order.city, order.address].filter(Boolean).join(", ");

  const text = [
    `🔔 <b>НОВЫЙ ЗАКАЗ #${order.id}</b>`,
    ``,
    `👤 <b>Клиент:</b>\n${order.fullName ?? "-"}`,
    ``,
    `📞 <b>Телефон:</b>\n${order.phone ?? "-"}`,
    ``,
    `📍 <b>Адрес:</b>\n${address || "-"}`,
    ``,
    `🛍 <b>Состав:</b>\n${items}`,
    ``,
    `💰 <b>Сумма:</b>\n${formatPrice(Number(order.total))}`,
    ``,
    `💳 <b>Оплата:</b>\nОжидает проверки`,
    ``,
    `📎 Чек прикреплён`,
  ].join("\n");

  const kb = new InlineKeyboard();
  if (order.receiptUrl) {
    kb.url("📎 Открыть чек", order.receiptUrl);
    kb.row();
  }
  kb.text("✅ Подтвердить оплату", `admin:payment:confirm:${order.id}`);
  kb.row();
  kb.text("❌ Отклонить оплату", `admin:payment:reject:${order.id}`);

  for (const adminId of adminIds) {
    await bot.api
      .sendMessage(adminId.toString(), text, {
        parse_mode: "HTML",
        reply_markup: kb,
      })
      .catch((e) => console.error("failed to notify admin", adminId, e));
  }
}

export async function notifyAdminOrderPaid(bot: Bot<any>, order: any) {
  const adminIds = getAdminIds();
  const text = `✅ Оплата заказа #${order.id} подтверждена. Заказ принят в обработку.`;

  for (const adminId of adminIds) {
    await bot.api
      .sendMessage(adminId.toString(), text)
      .catch((e) => console.error("failed to notify admin", adminId, e));
  }
}

export async function notifyAdminOrderRejected(bot: Bot<any>, order: any, reason: string) {
  const adminIds = getAdminIds();
  const text = `❌ Оплата заказа #${order.id} отклонена.\n\nПричина: ${reason}`;

  for (const adminId of adminIds) {
    await bot.api
      .sendMessage(adminId.toString(), text)
      .catch((e) => console.error("failed to notify admin", adminId, e));
  }
}