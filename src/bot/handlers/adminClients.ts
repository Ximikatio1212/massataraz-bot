import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getAllUsers } from "../../services/user.service";
import { editText } from "../helpers";
import { formatPrice, formatDate } from "../../utils/formatting";

export async function handleAdminClients(ctx: BotContext, offset = 0) {
  if (!ctx.state.user?.isAdmin) return;
  const users = await getAllUsers(10, offset);

  if (users.length === 0) {
    await editText(ctx, "👥 <b>КЛИЕНТЫ</b>\n\nПока нет ни одного пользователя.");
    return;
  }

  const kb = new InlineKeyboard();
  const lines = users.map((u) => {
    kb.text(
      `${u.firstName ?? "Без имени"} ${u.lastName ?? ""}`.trim(),
      `admin:client:view:${u.id}`
    );
    kb.row();
    return `ID: ${u.telegramId}\nИмя: ${u.firstName ?? "-"} ${u.lastName ?? ""}\nUsername: ${u.username ? "@" + u.username : "-"}\nЗаказов: ${u._count.orders}\nРегистрация: ${formatDate(u.createdAt)}`;
  });

  const text = [`👥 <b>КЛИЕНТЫ</b>`, ``, ...lines, ``].join("\n");

  if (offset > 0) kb.text("⬅️ Назад", `admin:client:list:${Math.max(0, offset - 10)}`);
  kb.text("🏠 Меню", "admin:menu");
  if (users.length >= 10) kb.text("Вперёд ➡️", `admin:client:list:${offset + 10}`);

  await editText(ctx, text, kb);
}

export async function handleClientView(ctx: BotContext, clientId: number) {
  if (!ctx.state.user?.isAdmin) return;

  const { getUserById } = await import("../../services/user.service");
  const { getUserOrders } = await import("../../services/order.service");
  const user = await getUserById(clientId);
  if (!user) {
    await editText(ctx, "❌ Пользователь не найден.");
    return;
  }

  const orders = await getUserOrders(user.id);
  const totalSpent = orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((s, o) => s + Number(o.total), 0);

  const text = [
    `👤 <b>${user.firstName ?? ""} ${user.lastName ?? ""}</b>`.trim(),
    ``,
    `🆔 Telegram ID: ${user.telegramId}`,
    `👤 Username: ${user.username ? "@" + user.username : "-"}`,
    `📅 Регистрация: ${formatDate(user.createdAt)}`,
    ``,
    `📦 Заказов: ${orders.length}`,
    `💰 Сумма покупок: ${formatPrice(totalSpent)}`,
  ].join("\n");

  const kb = new InlineKeyboard().text("⬅️ Назад", "admin:clients");
  await editText(ctx, text, kb);
}