import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getUserByTelegramId } from "../../services/user.service";
import { getUserOrders, countUserOrders, getOrderById } from "../../services/order.service";
import { editText, answerAlert } from "../helpers";
import { formatPrice, formatDate } from "../../utils/formatting";
import { t } from "../../i18n";

const PAGE_SIZE = 5;

function statusLabel(lang: string, status: string): string {
  return t(lang, `status_${status}`);
}

function paymentLabel(lang: string, status: string): string {
  return t(lang, `payment_${status}`);
}

export async function handleOrdersList(ctx: BotContext, page = 0) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const [orders, total] = await Promise.all([
    getUserOrders(dbUser.id, page * PAGE_SIZE, PAGE_SIZE),
    countUserOrders(dbUser.id),
  ]);

  if (orders.length === 0 && page === 0) {
    await editText(ctx, t(lang, "orders_empty"));
    return;
  }

  const kb = new InlineKeyboard();
  const lines = orders.map((o) => {
    kb.text(`№${o.id} • ${formatPrice(Number(o.total))}`, `order:view:${o.id}`);
    kb.row();
    return `№${o.id}\n💰 ${formatPrice(Number(o.total))}\n${statusLabel(lang, o.status)}\n${paymentLabel(lang, o.paymentStatus)}`;
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const text = [
    t(lang, "orders_title"),
    ``,
    ...lines,
    ``,
    t(lang, "orders_page", { a: page + 1, b: totalPages, n: total }),
  ].join("\n\n");

  if (page > 0) kb.text("⬅️", `orders:list:${page - 1}`);
  kb.text("☰", `orders:list:${page}`);
  if (orders.length >= PAGE_SIZE && (page + 1) * PAGE_SIZE < total) {
    kb.text("➡️", `orders:list:${page + 1}`);
  }
  kb.row();
  kb.text(t(lang, "btn_back_main"), "main:menu");

  await editText(ctx, text, kb);
}

export async function handleOrderView(ctx: BotContext, orderId: number) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const order = await getOrderById(orderId);

  // Users can ONLY see their own orders; admins can see any order.
  if (!order) {
    await answerAlert(ctx, t(lang, "order_not_found"));
    return;
  }
  if (!user.isAdmin && order.userId !== dbUser.id) {
    await answerAlert(ctx, t(lang, "order_denied"));
    return;
  }

  const items = order.items
    .map((i) => `• ${i.productName} × ${i.quantity} = ${formatPrice(Number(i.subtotal))}`)
    .join("\n");

  const address = [order.region, order.city, order.address].filter(Boolean).join(", ");

  const isAdmin = ctx.state.user.isAdmin;

  const text = [
    t(lang, "order_title", { id: order.id }),
    `📅 ${formatDate(order.createdAt)}`,
    ``,
    `${t(lang, "order_items")}\n${items}`,
    ``,
    t(lang, "order_total", { total: formatPrice(Number(order.total)) }),
    ``,
    t(lang, "order_address", { addr: address || "-" }),
    t(lang, "order_phone", { phone: order.phone ?? "-" }),
    ``,
    t(lang, "order_status", { status: statusLabel(lang, order.status) }),
    t(lang, "order_payment", { payment: paymentLabel(lang, order.paymentStatus) }),
  ].join("\n");

  const kb = new InlineKeyboard();
  if (order.receiptUrl) {
    kb.url(t(lang, "link_check"), order.receiptUrl);
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
    kb.text(t(lang, "btn_back"), "orders:list");
  }

  await editText(ctx, text, kb);
}