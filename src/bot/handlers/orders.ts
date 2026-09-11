import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getUserByTelegramId } from "../../services/user.service";
import { getUserOrders, countUserOrders, getOrderById } from "../../services/order.service";
import { editText, answerAlert } from "../helpers";
import { formatPrice, formatDate } from "../../utils/formatting";

const PAGE_SIZE = 5;

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "💤 Ожидает оплаты",
  pending_verification: "🕐 Ожидает проверки",
  paid: "✅ Оплачен",
  processing: "🔵 В обработке",
  shipped: "🚚 Отправлен",
  completed: "✅ Завершён",
  cancelled: "❌ Отменён",
};

const PAYMENT_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  pending_verification: "Ожидает проверки",
  paid: "Оплачен",
  rejected: "Отклонён",
};

export async function handleOrdersList(ctx: BotContext, page = 0) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const [orders, total] = await Promise.all([
    getUserOrders(dbUser.id, page * PAGE_SIZE, PAGE_SIZE),
    countUserOrders(dbUser.id),
  ]);

  if (orders.length === 0 && page === 0) {
    await editText(ctx, "📦 <b>МОИ ЗАКАЗЫ</b>\n\nУ вас пока нет заказов.");
    return;
  }

  const kb = new InlineKeyboard();
  const lines = orders.map((o) => {
    kb.text(`№${o.id} • ${formatPrice(Number(o.total))}`, `order:view:${o.id}`);
    kb.row();
    return `№${o.id}\n💰 ${formatPrice(Number(o.total))}\n${STATUS_LABELS[o.status] ?? o.status}\n${PAYMENT_LABELS[o.paymentStatus] ?? o.paymentStatus}`;
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const text = [
    `📦 <b>МОИ ЗАКАЗЫ</b>`,
    ``,
    ...lines,
    ``,
    `📄 Страница ${page + 1} из ${totalPages} • Всего: ${total}`,
  ].join("\n\n");

  if (page > 0) kb.text("⬅️", `orders:list:${page - 1}`);
  kb.text("☰", `orders:list:${page}`);
  if (orders.length >= PAGE_SIZE && (page + 1) * PAGE_SIZE < total) {
    kb.text("➡️", `orders:list:${page + 1}`);
  }
  kb.row();
  kb.text("⬅️ Главное меню", "main:menu");

  await editText(ctx, text, kb);
}

export async function handleOrderView(ctx: BotContext, orderId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const order = await getOrderById(orderId);

  // Users can ONLY see their own orders; admins can see any order.
  if (!order) {
    await answerAlert(ctx, "❌ Заказ не найден.");
    return;
  }
  if (!user.isAdmin && order.userId !== dbUser.id) {
    await answerAlert(ctx, "❌ Заказ не найден или доступ запрещён.");
    return;
  }

  const items = order.items
    .map((i) => `• ${i.productName} × ${i.quantity} = ${formatPrice(Number(i.subtotal))}`)
    .join("\n");

  const address = [order.region, order.city, order.address].filter(Boolean).join(", ");

  const isAdmin = ctx.state.user.isAdmin;

  const text = [
    `🧾 <b>ЗАКАЗ №${order.id}</b>`,
    `📅 ${formatDate(order.createdAt)}`,
    ``,
    `🛍 <b>Товары:</b>\n${items}`,
    ``,
    `💰 <b>Сумма: ${formatPrice(Number(order.total))}</b>`,
    ``,
    `📍 <b>Адрес:</b> ${address || "-"}`,
    `📞 <b>Телефон:</b> ${order.phone ?? "-"}`,
    ``,
    `📦 <b>Статус:</b> ${STATUS_LABELS[order.status] ?? order.status}`,
    `💳 <b>Оплата:</b> ${PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}`,
  ].join("\n");

  const kb = new InlineKeyboard();
  if (order.receiptUrl) {
    kb.url("📎 Чек", order.receiptUrl);
    kb.row();
  } else if (order.receiptFileId && isAdmin) {
    kb.text("👁 Смотреть чек", `admin:receipt:show:${order.id}`);
    kb.row();
  }
  if (isAdmin) {
    if (order.paymentStatus !== "paid") {
      kb.text("✅ Подтвердить оплату", `admin:payment:confirm:${order.id}`);
      kb.row();
      kb.text("❌ Отклонить оплату", `admin:payment:reject:${order.id}`);
      kb.row();
    }
    kb.text("🔄 Изменить статус", `admin:order:status:${order.id}`);
    kb.row();
    kb.text("⬅️ Назад", "admin:orders");
  } else {
    kb.text("⬅️ Назад", "orders:list");
  }

  await editText(ctx, text, kb);
}