import { InlineKeyboard } from "grammy";
import { Order } from "@prisma/client";

export function ordersListKeyboard(orders: Order[]) {
  const kb = new InlineKeyboard();
  orders.forEach((order, index) => {
    kb.text(`№${order.id}`, `order:view:${order.id}`);
    if (index % 3 === 2) kb.row();
  });
  if (orders.length % 3 !== 0) kb.row();
  kb.text("⬅️ Главное меню", "main:menu");
  return kb;
}

export function orderViewKeyboard(orderId: number, isAdmin: boolean) {
  const kb = new InlineKeyboard();
  if (isAdmin) {
    kb.text("🔄 Изменить статус", `admin:order:status:${orderId}`);
  }
  kb.row();
  kb.text("⬅️ Назад", isAdmin ? "admin:orders" : "orders:list");
  return kb;
}

export function orderStatusKeyboard(orderId: number) {
  const kb = new InlineKeyboard()
    .text("❌ Отменён", `admin:order:setstatus:cancelled:${orderId}`)
    .row()
    .text("🚚 Отправлен", `admin:order:setstatus:shipped:${orderId}`)
    .row()
    .text("✅ Выполнен", `admin:order:setstatus:completed:${orderId}`)
    .row()
    .text("⬅️ Назад", `order:view:${orderId}`);
  return kb;
}