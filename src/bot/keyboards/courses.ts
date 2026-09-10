import { InlineKeyboard } from "grammy";
import { Course } from "@prisma/client";

export function coursesListKeyboard(courses: Course[]) {
  const kb = new InlineKeyboard();
  courses.forEach((course, index) => {
    kb.text(`🔥 ${course.name}`, `course:view:${course.id}`);
    if (index % 2 === 1) kb.row();
  });
  if (courses.length % 2 !== 0) kb.row();
  kb.text("⬅️ Главное меню", "main:menu");
  return kb;
}

export function courseActionsKeyboard(courseId: number) {
  return new InlineKeyboard()
    .text("🛒 Добавить в корзину", `course:add:${courseId}`)
    .row()
    .text("🛒 Корзина", "cart:view")
    .row()
    .text("⬅️ Назад", "courses:list");
}