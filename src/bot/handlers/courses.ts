import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getActiveCourses, getCourseById } from "../../services/course.service";
import { addCourseToCart } from "../../services/cart.service";
import { getUserByTelegramId } from "../../services/user.service";
import { editText, answerAlert } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { userFriendlyError } from "../../utils/errors";

export async function handleCoursesList(ctx: BotContext) {
  if (!ctx.state.user) return;
  const courses = await getActiveCourses();

  if (courses.length === 0) {
    await editText(ctx, "📚 <b>ГОТОВЫЕ СВЯЗКИ</b>\n\nПока нет доступных курсов.");
    return;
  }

  const kb = new InlineKeyboard();
  let text = "📚 <b>ГОТОВЫЕ СВЯЗКИ</b>\n\n";

  courses.forEach((course) => {
    text += `🔥 <b>${course.name}</b>\n💊 ${course.items.length} товар${
      course.items.length === 1 ? "" : course.items.length < 5 ? "а" : "ов"
    }\n💰 ${formatPrice(Number(course.price))}\n\n`;
    kb.text(`🔥 ${course.name}`, `course:view:${course.id}`);
    kb.row();
  });

  kb.text("⬅️ Назад", "main:menu");
  await editText(ctx, text, kb);
}

export async function handleCourseView(ctx: BotContext, courseId: number) {
  if (!ctx.state.user) return;
  const course = await getCourseById(courseId);

  if (!course || !course.isActive) {
    await answerAlert(ctx, "❌ Курс не найден или недоступен.");
    return;
  }

  const components = course.items
    .map((item) => `• ${item.product.name} × ${item.quantity}`)
    .join("\n");

  const kb = new InlineKeyboard()
    .text("🛒 Добавить в корзину", `course:add:${course.id}`)
    .row()
    .text("🛒 Корзина", "cart:view")
    .row()
    .text("⬅️ Назад", "courses:list");

  const text = [
    `🔥 <b>${course.name}</b>`,
    ``,
    course.description ?? "",
    ``,
    `📦 <b>В комплекте:</b>`,
    components,
    ``,
    `💰 Цена курса: ${formatPrice(Number(course.price))}`,
  ].join("\n");

  await editText(ctx, text, kb);
}

export async function handleCourseAdd(ctx: BotContext, courseId: number, quantity = 1) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  try {
    await addCourseToCart(dbUser.id, courseId, quantity);
    await answerAlert(ctx, "✅ Курс добавлен в корзину");
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC"));
  }
}