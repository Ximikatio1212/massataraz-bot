import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getActiveCourses, getCourseById } from "../../services/course.service";
import { addCourseToCart } from "../../services/cart.service";
import { getUserByTelegramId } from "../../services/user.service";
import { renderPhoto, editText, answerAlert } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { userFriendlyError } from "../../utils/errors";
import { t, itemsWord } from "../../i18n";

export async function handleCoursesList(ctx: BotContext) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const courses = await getActiveCourses();

  if (courses.length === 0) {
    await editText(ctx, t(lang, "courses_empty"));
    return;
  }

  const kb = new InlineKeyboard();
  let text = `${t(lang, "courses_title")}\n\n`;

  courses.forEach((course) => {
    const word = itemsWord(lang, course.items.length);
    text += `🔥 <b>${course.name}</b>\n💊 ${course.items.length} ${word}\n💰 ${formatPrice(Number(course.price))}\n\n`;
    kb.text(`🔥 ${course.name}`, `course:view:${course.id}`);
    kb.row();
  });

  kb.text(t(lang, "btn_back"), "main:menu");
  await editText(ctx, text, kb);
}

export async function handleCourseView(ctx: BotContext, courseId: number) {
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  const course = await getCourseById(courseId);

  if (!course || !course.isActive) {
    await answerAlert(ctx, t(lang, "course_not_found"));
    return;
  }

  const components = course.items
    .map((item) => `• ${item.product.name} × ${item.quantity}`)
    .join("\n");

  const kb = new InlineKeyboard()
    .text(t(lang, "btn_add_course_cart"), `course:add:${course.id}`)
    .row()
    .text(t(lang, "btn_cart"), "cart:view")
    .row()
    .text(t(lang, "btn_back"), "courses:list");

  const text = [
    `🔥 <b>${course.name}</b>`,
    ``,
    course.description ?? "",
    ``,
    t(lang, "in_pack"),
    components,
    ``,
    t(lang, "course_price", { price: formatPrice(Number(course.price)) }),
  ].join("\n");

  const photo = resolveImageUrl(course.imageUrl);
  if (photo) {
    await renderPhoto(ctx, photo, text, kb);
    return;
  }

  await editText(ctx, text, kb);
}

function resolveImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("tg:")) return imageUrl.slice(3);
  return imageUrl;
}

export async function handleCourseAdd(ctx: BotContext, courseId: number, quantity = 1) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  const lang = dbUser.lang ?? "ru";

  try {
    await addCourseToCart(dbUser.id, courseId, quantity);
    await answerAlert(ctx, t(lang, "course_added"));
    const msg = ctx.callbackQuery?.message as any;
    if (msg?.caption != null) await ctx.deleteMessage().catch(() => {});
  } catch (e: any) {
    await answerAlert(ctx, userFriendlyError(e.message ?? "GENERIC", lang));
  }
}