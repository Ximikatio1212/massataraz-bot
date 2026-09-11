import { InlineKeyboard } from "grammy";
import { BotContext } from "../middleware/auth";
import { getUserByTelegramId } from "../../services/user.service";
import { setState, resetState, getState } from "../../services/state.service";
import { ConversationState } from "@prisma/client";
import {
  adminProductsKeyboard,
  adminCategoriesKeyboard,
  adminCoursesKeyboard,
  adminOrdersKeyboard,
  adminPaymentsKeyboard,
  adminProductListKeyboard,
  adminCategoryListKeyboard,
  adminCourseListKeyboard,
} from "../keyboards/admin";
import { adminMenuKeyboard } from "../keyboards/main";
import { editText, replyText, answerAlert } from "../helpers";
import { formatPrice } from "../../utils/formatting";
import { validatePrice, validateQuantity, validateName } from "../../utils/validation";
import { userFriendlyError } from "../../utils/errors";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductActive,
  deleteProduct,
} from "../../services/product.service";
import {
  getActiveCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryActive,
  getAllCategories,
  deleteCategoryHard,
} from "../../services/category.service";
import {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  toggleCourseActive,
  addCourseItem,
  removeCourseItem,
  deleteCourse,
} from "../../services/course.service";
import { getAllOrders, getOrderById, changeOrderStatus, confirmOrderPayment, rejectOrderPayment } from "../../services/order.service";
import { getPaymentsByStatus } from "../../services/payment.service";
import { getStatistics } from "../../services/statistics.service";
import { uploadFile } from "../../services/storage.service";
import { notifyAdminOrderPaid } from "../../services/notifications.service";
import { getBot } from "../../instance";

/* ------------------------------------------------------------------ */
/* Admin navigation                                                    */
/* ------------------------------------------------------------------ */

export function isAdminUser(ctx: BotContext): boolean {
  if (!ctx.state.user?.isAdmin) {
    ctx.answerCallbackQuery({ text: userFriendlyError("NOT_ADMIN"), show_alert: true }).catch(() => {});
    return false;
  }
  return true;
}

export async function handleAdminMenu(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  await editText(ctx, "⚙️ <b>АДМИН-ПАНЕЛЬ</b>\n\nВыберите раздел:", adminMenuKeyboard());
}

export async function handleAdminProducts(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  await editText(ctx, "📦 <b>ТОВАРЫ</b>\n\nВыберите действие:", adminProductsKeyboard());
}

export async function handleAdminCategories(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  await editText(ctx, "📁 <b>КАТЕГОРИИ</b>\n\nВыберите действие:", adminCategoriesKeyboard());
}

export async function handleAdminCourses(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  await editText(ctx, "📚 <b>ГОТОВЫЕ СВЯЗКИ</b>\n\nВыберите действие:", adminCoursesKeyboard());
}

export async function handleAdminClearOrders(ctx: BotContext, target: string) {
  if (!isAdminUser(ctx)) return;
  const { countOrders } = await import("../../services/order.service");

  let statuses: ("completed" | "cancelled")[];
  if (target === "completed" || target === "old") {
    statuses = ["completed", "cancelled"];
  } else {
    statuses = [];
  }

  const count = await countOrders(statuses);
  const kb = new InlineKeyboard()
    .text(`✅ Да, удалить (${count})`, `admin:order:clear:yes:${target}`)
    .row()
    .text("❌ Отмена", "admin:orders");
  await editText(ctx, `🧹 <b>ОЧИСТКА ИСТОРИИ</b>\n\nУдалить <b>${count}</b> завершённых/отменённых заказов? Это действие необратимо.`, kb);
}

export async function handleAdminClearOrdersConfirm(ctx: BotContext, target: string, yes: boolean) {
  if (!isAdminUser(ctx)) return;
  if (!yes) {
    await editText(ctx, "❌ Отменено.", adminOrdersKeyboard());
    return;
  }
  const { clearOrdersByStatus } = await import("../../services/order.service");
  const deleted = await clearOrdersByStatus(["completed", "cancelled"]);
  await editText(ctx, `✅ Удалено заказов: <b>${deleted}</b>.`, adminOrdersKeyboard());
}

export async function handleAdminClearAllOrders(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  const { countOrders } = await import("../../services/order.service");
  const count = await countOrders();
  const kb = new InlineKeyboard()
    .text(`✅ Да, удалить все (${count})`, "admin:order:clearall:yes")
    .row()
    .text("❌ Отмена", "admin:orders");
  await editText(
    ctx,
    `🗑 <b>УДАЛИТЬ ВСЕ ЗАКАЗЫ</b>\n\nБудут удалены <b>${count}</b> заказ(а/ов) вместе с историями оплат.\n\n⚠️ Действие необратимо. Продолжить?`,
    kb
  );
}

export async function handleAdminClearAllOrdersConfirm(ctx: BotContext, yes: boolean) {
  if (!isAdminUser(ctx)) return;
  if (!yes) {
    await editText(ctx, "❌ Отменено.", adminOrdersKeyboard());
    return;
  }
  const { deleteAllOrders } = await import("../../services/order.service");
  let deleted = 0;
  try {
    deleted = await deleteAllOrders();
  } catch (e) {
    return answerAlert(ctx, userFriendlyError("UPDATE_FAILED"));
  }
  await editText(ctx, `✅ Удалено <b>${deleted}</b> заказов. База очищена.`, adminOrdersKeyboard());
}

export async function handleAdminOrders(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  const { getOrderCounts } = await import("../../services/order.service");
  const counts = await getOrderCounts();
  const text = [
    `🛒 <b>ЗАКАЗЫ</b>`,
    ``,
    `🟡 На проверке: ${counts.pendingVerification}`,
    `🔵 В обработке: ${counts.processing}`,
    `🚚 Отправлены: ${counts.shipped}`,
    `✅ Завершены: ${counts.completed}`,
    `💤 Ожидают оплаты: ${counts.waitingPayment}`,
  ].join("\n");
  await editText(ctx, text, adminOrdersKeyboard());
}

export async function handleAdminPayments(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  await editText(ctx, "💳 <b>ОПЛАТЫ</b>\n\nВыберите раздел:", adminPaymentsKeyboard());
}

export async function handleAdminStatistics(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  const stats = await getStatistics();

  const topProducts = stats.topProducts.length
    ? stats.topProducts.slice(0, 5).map((p, i) => `${i + 1}. ${p.name} — ${p.quantity} шт.`).join("\n")
    : "Нет данных";

  const topCourses = stats.topCourses.length
    ? stats.topCourses.slice(0, 5).map((c, i) => `${i + 1}. ${c.name} — ${c.quantity} шт.`).join("\n")
    : "Нет данных";

  const lowStock = stats.lowStockProducts.length
    ? stats.lowStockProducts.map((p) => `• ${p.name} — ${p.stock} шт.`).join("\n")
    : "Нет товаров с низким остатком";

  const text = [
    `📊 <b>СТАТИСТИКА</b>`,
    ``,
    `👥 Пользователей: ${stats.usersCount}`,
    `🛍 Заказов всего: ${stats.ordersCount}`,
    `💰 Общая сумма продаж: ${formatPrice(stats.totalSales)}`,
    `✅ Оплаченных заказов: ${stats.paidOrdersCount}`,
    `🕐 Заказов на проверке: ${stats.pendingVerificationOrdersCount}`,
    `📦 Активных товаров: ${stats.activeProductsCount}`,
    `⚠️ Товаров с низким остатком: ${stats.lowStockProductsCount}`,
    ``,
    `🏆 <b>Самые продаваемые товары:</b>`,
    topProducts,
    ``,
    `🏆 <b>Самые продаваемые курсы:</b>`,
    topCourses,
    ``,
    `⚠️ <b>Низкий остаток:</b>`,
    lowStock,
  ].join("\n");

  const kb = new InlineKeyboard().text("⬅️ Назад", "admin:menu");
  await editText(ctx, text, kb);
}

/* ------------------------------------------------------------------ */
/* Cancel                                                              */
/* ------------------------------------------------------------------ */

export async function handleCancelCurrent(ctx: BotContext) {
  if (!ctx.state.user) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;
  await resetState(dbUser.id);
  if (user.isAdmin) {
    await editText(ctx, "❌ Действие отменено.\n\n⚙️ <b>АДМИН-ПАНЕЛЬ</b>", adminMenuKeyboard());
  } else {
    await editText(ctx, "❌ Действие отменено.");
  }
}

/* ------------------------------------------------------------------ */
/* Toggle objects                                                      */
/* ------------------------------------------------------------------ */

async function toggleObject(ctx: BotContext, kind: "product" | "category" | "course", id: number) {
  if (!isAdminUser(ctx)) return;
  let isActive = true;
  if (kind === "product") {
    const p = await getProductById(id);
    if (!p) return answerAlert(ctx, "❌ Объект не найден.");
    isActive = p.isActive;
    await toggleProductActive(id, !isActive);
  } else if (kind === "category") {
    const c = await getCategoryById(id);
    if (!c) return answerAlert(ctx, "❌ Объект не найден.");
    isActive = c.isActive;
    await toggleCategoryActive(id, !isActive);
  } else if (kind === "course") {
    const c = await getCourseById(id);
    if (!c) return answerAlert(ctx, "❌ Объект не найден.");
    isActive = c.isActive;
    await toggleCourseActive(id, !isActive);
  }

  await answerAlert(ctx, isActive ? "✅ Объект скрыт." : "🟢 Объект показан.");
  if (kind === "product") return handleAdminProductView(ctx, id);
  if (kind === "category") return handleAdminCategoryView(ctx, id);
  if (kind === "course") return handleAdminCourseView(ctx, id);
}

export async function handleAdminProductToggle(ctx: BotContext, id: number) {
  return toggleObject(ctx, "product", id);
}
export async function handleAdminCategoryToggle(ctx: BotContext, id: number) {
  return toggleObject(ctx, "category", id);
}
export async function handleAdminCourseToggle(ctx: BotContext, id: number) {
  return toggleObject(ctx, "course", id);
}

/* ------------------------------------------------------------------ */
/* Delete objects                                                      */
/* ------------------------------------------------------------------ */

async function deleteObjectConfirm(ctx: BotContext, kind: "product" | "category" | "course", id: number) {
  if (!isAdminUser(ctx)) return;
  let name = "";
  if (kind === "product") {
    const p = await getProductById(id);
    if (!p) return answerAlert(ctx, "❌ Товар не найден.");
    name = p.name;
  } else if (kind === "category") {
    const c = await getCategoryById(id);
    if (!c) return answerAlert(ctx, "❌ Категория не найдена.");
    name = c.name;
  } else if (kind === "course") {
    const c = await getCourseById(id);
    if (!c) return answerAlert(ctx, "❌ Курс не найден.");
    name = c.name;
  }

  const kb = new InlineKeyboard()
    .text("🗑 Да, удалить", `admin:${kind}:delete:yes:${id}`)
    .row()
    .text("❌ Отмена", `admin:${kind}:delete:no:${id}`);
  await editText(ctx, `⚠️ <b>УДАЛЕНИЕ</b>\n\nВы действительно хотите удалить «${name}»?\n\nЭто действие необратимо.`, kb);
}

async function deleteObjectExecute(ctx: BotContext, kind: "product" | "category" | "course", id: number) {
  if (!isAdminUser(ctx)) return;
  let result: { ok: boolean; error?: string };
  if (kind === "product") {
    result = await deleteProduct(id);
  } else if (kind === "category") {
    result = await deleteCategoryHard(id);
  } else {
    result = await deleteCourse(id);
  }
  if (!result.ok) {
    return answerAlert(ctx, userFriendlyError(result.error ?? "UPDATE_FAILED"));
  }
  await editText(ctx, `🗑 <b>Удалено.</b>`);
  if (kind === "product") return handleAdminProductList(ctx, 0);
  if (kind === "category") return handleAdminCategoryList(ctx, 0);
  return handleAdminCourseList(ctx, 0);
}

export async function handleAdminProductDelete(ctx: BotContext, id: number, yes?: boolean) {
  if (yes === true) return deleteObjectExecute(ctx, "product", id);
  return deleteObjectConfirm(ctx, "product", id);
}
export async function handleAdminCategoryDelete(ctx: BotContext, id: number, yes?: boolean) {
  if (yes === true) return deleteObjectExecute(ctx, "category", id);
  return deleteObjectConfirm(ctx, "category", id);
}
export async function handleAdminCourseDelete(ctx: BotContext, id: number, yes?: boolean) {
  if (yes === true) return deleteObjectExecute(ctx, "course", id);
  return deleteObjectConfirm(ctx, "course", id);
}

/* ------------------------------------------------------------------ */
/* Lists                                                               */
/* ------------------------------------------------------------------ */

export async function handleAdminProductList(ctx: BotContext, offset = 0) {
  if (!isAdminUser(ctx)) return;
  const products = await getAllProducts(false);
  const slice = products.slice(offset, offset + 10);
  if (slice.length === 0) {
    await editText(ctx, "📦 Товаров нет.", adminProductsKeyboard());
    return;
  }
  await editText(ctx, `📦 <b>ТОВАРЫ</b>\n\nВыберите товар:`, adminProductListKeyboard(slice, offset, 10));
}

export async function handleAdminProductHidden(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  const products = await getAllProducts(true);
  if (products.length === 0) {
    await editText(ctx, "🔴 Скрытых товаров нет.", adminProductsKeyboard());
    return;
  }
  const kb = new InlineKeyboard();
  products.forEach((p) => {
    kb.text(`${p.name.length > 40 ? p.name.slice(0, 40) + "…" : p.name}`, `admin:product:view:${p.id}`);
    kb.row();
  });
  kb.text("⬅️ Назад", "admin:products");
  await editText(ctx, `🔴 <b>СКРЫТЫЕ ТОВАРЫ</b>`, kb);
}

export async function handleAdminCategoryList(ctx: BotContext, offset = 0) {
  if (!isAdminUser(ctx)) return;
  const categories = await getAllCategories();
  const slice = categories.slice(offset, offset + 10);
  if (slice.length === 0) {
    await editText(ctx, "📁 Категорий нет.", adminCategoriesKeyboard());
    return;
  }
  await editText(ctx, `📁 <b>КАТЕГОРИИ</b>\n\nВыберите категорию:`, adminCategoryListKeyboard(slice, offset, 10));
}

export async function handleAdminCategoryHidden(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  const categories = await getAllCategories();
  const hidden = categories.filter((c) => !c.isActive);
  if (hidden.length === 0) {
    await editText(ctx, "🔴 Скрытых категорий нет.", adminCategoriesKeyboard());
    return;
  }
  const kb = new InlineKeyboard();
  hidden.forEach((c) => {
    kb.text(c.name, `admin:category:view:${c.id}`);
    kb.row();
  });
  kb.text("⬅️ Назад", "admin:categories");
  await editText(ctx, `🔴 <b>СКРЫТЫЕ КАТЕГОРИИ</b>`, kb);
}

export async function handleAdminCourseList(ctx: BotContext, offset = 0) {
  if (!isAdminUser(ctx)) return;
  const courses = await getAllCourses();
  const slice = courses.slice(offset, offset + 10);
  if (slice.length === 0) {
    await editText(ctx, "📚 Курсов нет.", adminCoursesKeyboard());
    return;
  }
  await editText(ctx, `📚 <b>КУРСЫ</b>\n\nВыберите курс:`, adminCourseListKeyboard(slice, offset, 10));
}

export async function handleAdminCourseHidden(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  const courses = await getAllCourses();
  const hidden = courses.filter((c) => !c.isActive);
  if (hidden.length === 0) {
    await editText(ctx, "🔴 Скрытых курсов нет.", adminCoursesKeyboard());
    return;
  }
  const kb = new InlineKeyboard();
  hidden.forEach((c) => {
    kb.text(c.name, `admin:course:view:${c.id}`);
    kb.row();
  });
  kb.text("⬅️ Назад", "admin:courses");
  await editText(ctx, `🔴 <b>СКРЫТЫЕ КУРСЫ</b>`, kb);
}

/* ------------------------------------------------------------------ */
/* View single objects                                                 */
/* ------------------------------------------------------------------ */

export async function handleAdminProductView(ctx: BotContext, productId: number) {
  if (!isAdminUser(ctx)) return;
  const product = await getProductById(productId);
  if (!product) {
    await answerAlert(ctx, "❌ Товар не найден.");
    return;
  }
  const status = product.isActive ? "✅ Активен" : "🔴 Скрыт";
  const text = [
    `💊 <b>${product.name}</b>`,
    ``,
    product.description ?? "",
    ``,
    `💰 Цена: ${formatPrice(Number(product.price))}`,
    `📦 Остаток: ${product.stock} шт.`,
    `📁 Категория: ${product.category?.name ?? "-"}`,
    ``,
    status,
  ].join("\n");

  const kb = new InlineKeyboard()
    .text("✏️ Редактировать", `admin:product:edit:name:${product.id}`)
    .row()
    .text(product.isActive ? "🔴 Скрыть товар" : "🟢 Показать товар", `admin:product:toggle:${product.id}`)
    .row()
    .text("🗑 Удалить товар", `admin:product:delete:${product.id}`)
    .row()
    .text("⬅️ Назад", "admin:products");

  await editText(ctx, text, kb);
}

export async function handleAdminCategoryView(ctx: BotContext, categoryId: number) {
  if (!isAdminUser(ctx)) return;
  const category = await getCategoryById(categoryId);
  if (!category) {
    await answerAlert(ctx, "❌ Категория не найдена.");
    return;
  }
  const status = category.isActive ? "✅ Активна" : "🔴 Скрыта";
  const text = [
    `📁 <b>${category.name}</b>`,
    ``,
    category.description ?? "",
    ``,
    status,
  ].join("\n");

  const kb = new InlineKeyboard()
    .text("✏️ Редактировать", `admin:category:edit:name:${category.id}`)
    .row()
    .text(category.isActive ? "🔴 Скрыть категорию" : "🟢 Показать категорию", `admin:category:toggle:${category.id}`)
    .row()
    .text("🗑 Удалить категорию", `admin:category:delete:${category.id}`)
    .row()
    .text("⬅️ Назад", "admin:categories");
  await editText(ctx, text, kb);
}

export async function handleAdminCourseView(ctx: BotContext, courseId: number) {
  if (!isAdminUser(ctx)) return;
  const course = await getCourseById(courseId);
  if (!course) {
    await answerAlert(ctx, "❌ Курс не найден.");
    return;
  }
  const items = course.items.map((i) => `• ${i.product.name} × ${i.quantity}`).join("\n");
  const status = course.isActive ? "✅ Активен" : "🔴 Скрыт";

  const text = [
    `📚 <b>${course.name}</b>`,
    ``,
    course.description ?? "",
    ``,
    `💰 Цена: ${formatPrice(Number(course.price))}`,
    ``,
    `📦 <b>В комплекте:</b>\n${items || "Пусто"}`,
    ``,
    status,
  ].join("\n");

  const kb = new InlineKeyboard()
    .text("✏️ Редактировать", `admin:course:edit:name:${course.id}`)
    .row()
    .text(course.isActive ? "🔴 Скрыть курс" : "🟢 Показать курс", `admin:course:toggle:${course.id}`)
    .row()
    .text("➕ Добавить товар", `admin:course:items:add:${course.id}`)
    .row()
    .text("📋 Состав курса", `admin:course:items:list:${course.id}`)
    .row()
    .text("🗑 Удалить курс", `admin:course:delete:${course.id}`)
    .row()
    .text("⬅️ Назад", "admin:courses");

  await editText(ctx, text, kb);
}

/* ------------------------------------------------------------------ */
/* Product creation flow                                               */
/* ------------------------------------------------------------------ */

export async function handleAdminProductCreateCommand(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  await resetState(dbUser.id);
  await setState(dbUser.id, ConversationState.WAITING_PRODUCT_NAME, {});
  await replyText(ctx, `📦 <b>ДОБАВЛЕНИЕ ТОВАРА</b>\n\n1️⃣ Введите <b>название</b> товара:`);
}

export async function handleAdminProductCreateCat(ctx: BotContext, categoryId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = { ...((state?.payload ?? {}) as any) };

  if (payload.editProductId) {
    await updateProduct(Number(payload.editProductId), { categoryId });
    await editText(ctx, "✅ Категория обновлена.");
    return handleAdminProductView(ctx, Number(payload.editProductId));
  }

  payload.categoryId = categoryId;
  await setState(dbUser.id, ConversationState.WAITING_PRODUCT_STOCK, payload);
  await replyText(ctx, `5️⃣ Введите <b>количество на складе</b> (целое число):`);
}

export async function handleAdminProductCreateNoImage(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = { ...((state?.payload ?? {}) as any) };
  payload.imageUrl = null;

  await handleNoImage(ctx, dbUser.id, "product", payload);
}

async function handleNoImage(
  ctx: BotContext,
  userId: number,
  kind: "product" | "category" | "course",
  payload: any
) {
  if (payload.editProductId) {
    await updateProduct(Number(payload.editProductId), { imageUrl: null });
    await resetState(userId);
    return handleAdminProductView(ctx, Number(payload.editProductId));
  }
  if (payload.editCategoryId) {
    await updateCategory(Number(payload.editCategoryId), { imageUrl: null });
    await resetState(userId);
    return handleAdminCategoryView(ctx, Number(payload.editCategoryId));
  }
  if (payload.editCourseId) {
    await updateCourse(Number(payload.editCourseId), { imageUrl: null });
    await resetState(userId);
    return handleAdminCourseView(ctx, Number(payload.editCourseId));
  }

  if (kind === "product") return showProductPreview(ctx, userId, payload);
  if (kind === "category") return showCategoryPreview(ctx, userId, payload);
  return showCoursePreview(ctx, userId, payload);
}

export async function handleAdminProductCreateConfirm(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};

  if (!payload.name || !payload.price || !payload.categoryId) {
    await answerAlert(ctx, "❌ Данные неполные. Начните заново.");
    await resetState(dbUser.id);
    return;
  }

  try {
    const product = await createProduct({
      name: payload.name,
      price: Number(payload.price),
      description: payload.description ?? null,
      categoryId: Number(payload.categoryId),
      stock: Number(payload.stock ?? 0),
      imageUrl: payload.imageUrl,
    });
    await resetState(dbUser.id);
    const kb = new InlineKeyboard()
      .text("➕ Добавить ещё", "admin:product:create:start")
      .row()
      .text("📦 Товары", "admin:products")
      .row()
      .text("⬅️ Админ-панель", "admin:menu");
    await editText(ctx, `✅ <b>Товар создан!</b>\n\n💊 ${product.name}\n💰 ${formatPrice(Number(product.price))}`, kb);
  } catch (e) {
    await answerAlert(ctx, "❌ Не удалось создать товар.");
  }
}

function productPreviewText(payload: any) {
  return [
    `💊 <b>${payload.name}</b>`,
    ``,
    payload.description ?? "",
    ``,
    `💰 ${formatPrice(Number(payload.price))}`,
    `📦 Остаток: ${payload.stock ?? 0}`,
    ``,
    `📁 Категория ID: ${payload.categoryId}`,
  ].join("\n");
}

function showProductPreview(ctx: BotContext, userId: number, payload: any) {
  return setStateAndPreview(ctx, userId, ConversationState.WAITING_PRODUCT_IMAGE, payload, productPreviewText(payload), {
    confirm: "admin:product:create:confirm",
  });
}

/* ------------------------------------------------------------------ */
/* Category creation flow                                              */
/* ------------------------------------------------------------------ */

export async function handleAdminCategoryCreateCommand(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  await resetState(dbUser.id);
  await setState(dbUser.id, ConversationState.WAITING_CATEGORY_NAME, {});
  await replyText(ctx, `📁 <b>СОЗДАНИЕ КАТЕГОРИИ</b>\n\n1️⃣ Введите <b>название</b> категории:`);
}

export async function handleAdminCategoryCreateNoImage(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const state = await getState(dbUser.id);
  const payload: any = { ...((state?.payload ?? {}) as any) };
  payload.imageUrl = null;
  await handleNoImage(ctx, dbUser.id, "category", payload);
}

export async function handleAdminCategoryCreateConfirm(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  if (!payload.name) {
    await answerAlert(ctx, "❌ Название обязательное.");
    await resetState(dbUser.id);
    return;
  }

  if (payload.editCategoryId) {
    const edited = await updateCategory(Number(payload.editCategoryId), {
      name: payload.name,
      description: payload.description ?? null,
      imageUrl: payload.imageUrl ?? null,
    });
    await resetState(dbUser.id);
    return handleAdminCategoryView(ctx, edited.id);
  }

  try {
    const category = await createCategory({
      name: payload.name,
      description: payload.description,
      imageUrl: payload.imageUrl,
    });
    await resetState(dbUser.id);
    const kb = new InlineKeyboard()
      .text("➕ Создать ещё", "admin:category:create:start")
      .row()
      .text("📁 Категории", "admin:categories")
      .row()
      .text("⬅️ Админ-панель", "admin:menu");
    await editText(ctx, `✅ <b>Категория создана:</b>\n\n📁 ${category.name}`, kb);
  } catch (e) {
    await answerAlert(ctx, "❌ Не удалось создать категорию.");
  }
}

function categoryPreviewText(payload: any) {
  return [`📁 <b>${payload.name}</b>`, ``, payload.description ?? ""].join("\n");
}

function showCategoryPreview(ctx: BotContext, userId: number, payload: any) {
  return setStateAndPreview(ctx, userId, ConversationState.WAITING_CATEGORY_IMAGE, payload, categoryPreviewText(payload), {
    confirm: "admin:category:create:confirm",
  });
}

/* ------------------------------------------------------------------ */
/* Course creation flow                                                */
/* ------------------------------------------------------------------ */

export async function handleAdminCourseCreateCommand(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  await resetState(dbUser.id);
  await setState(dbUser.id, ConversationState.WAITING_COURSE_NAME, { items: [] });
  await replyText(ctx, `📚 <b>СОЗДАНИЕ КУРСА</b>\n\n1️⃣ Введите <b>название</b> курса:`);
}

export async function handleAdminCourseCreateAddItem(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const activeProducts = await getAllProducts(false);
  const available = activeProducts.filter((p) => p.isActive);

  if (available.length === 0) {
    await answerAlert(ctx, "❌ Нет доступных товаров. Сначала создайте товары.");
    return;
  }

  const kb = new InlineKeyboard();
  available.forEach((p, i) => {
    kb.text(`${p.name.length > 30 ? p.name.slice(0, 30) + "…" : p.name}`, `admin:course:create:item:${p.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (available.length % 2 !== 0) kb.row();
  kb.text("⬅️ Назад", "cancel:current");

  await editText(ctx, `📦 <b>Выберите товар для добавления в курс:</b>`, kb);
}

export async function handleAdminCourseCreateItem(ctx: BotContext, productId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = { ...((state?.payload ?? {}) as any) };
  payload.addingProductId = productId;
  await setState(dbUser.id, ConversationState.WAITING_COURSE_ITEMS, payload);
  await replyText(ctx, `Введите <b>количество</b> этого товара в комплекте:`);
}

export async function handleAdminCourseCreateItemConfirm(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};
  delete payload.addingProductId;
  await setState(dbUser.id, ConversationState.WAITING_COURSE_IMAGE, payload);

  await replyText(
    ctx,
    `📚 Завершите создание курса.\n\nОтправьте <b>изображение</b> курса или нажмите «Без фото»:`,
    new InlineKeyboard()
      .text("🚫 Без фото", "admin:course:create:noimage")
      .row()
      .text("❌ Отмена", "cancel:current")
  );
}

export async function handleAdminCourseCreateNoImage(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const state = await getState(dbUser.id);
  const payload: any = { ...((state?.payload ?? {}) as any) };
  payload.imageUrl = null;
  await handleNoImage(ctx, dbUser.id, "course", payload);
}

export async function handleAdminCourseCreateConfirm(ctx: BotContext) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const state = await getState(dbUser.id);
  const payload: any = state?.payload ?? {};

  if (!payload.name || !payload.price || !payload.items?.length) {
    await answerAlert(ctx, "❌ Данные неполные (название, цена, минимум 1 товар).");
    await resetState(dbUser.id);
    return;
  }

  try {
    if (payload.editCourseId) {
      const edited = await updateCourse(Number(payload.editCourseId), {
        name: payload.name,
        price: Number(payload.price),
        description: payload.description ?? null,
        imageUrl: payload.imageUrl ?? null,
      });
      for (const added of payload.items) {
        await addCourseItem(edited.id, Number(added.productId), Number(added.quantity));
      }
      await resetState(dbUser.id);
      return handleAdminCourseView(ctx, edited.id);
    }

    const course = await createCourse({
      name: payload.name,
      price: Number(payload.price),
      description: payload.description,
      imageUrl: payload.imageUrl,
    });
    for (const added of payload.items) {
      await addCourseItem(course.id, Number(added.productId), Number(added.quantity));
    }
    await resetState(dbUser.id);
    const kb = new InlineKeyboard()
      .text("➕ Создать ещё", "admin:course:create:start")
      .row()
      .text("📚 Курсы", "admin:courses")
      .row()
      .text("⬅️ Админ-панель", "admin:menu");
    await editText(ctx, `✅ <b>Курс создан!</b>\n\n📚 ${course.name}\n💰 ${formatPrice(Number(course.price))}`, kb);
  } catch (e) {
    await answerAlert(ctx, "❌ Не удалось создать курс.");
  }
}

function coursePreviewText(payload: any) {
  const items = (payload.items ?? [])
    .map((i: any) => `• ${i.productName ?? `Товар #${i.productId}`} × ${i.quantity}`)
    .join("\n");
  return [
    `🔥 <b>${payload.name}</b>`,
    ``,
    payload.description ?? "",
    ``,
    `📦 <b>В комплекте:</b>`,
    items,
    ``,
    `💰 Цена курса: ${formatPrice(Number(payload.price))}`,
  ].join("\n");
}

function showCoursePreview(ctx: BotContext, userId: number, payload: any) {
  return setStateAndPreview(ctx, userId, ConversationState.WAITING_COURSE_IMAGE, payload, coursePreviewText(payload), {
    confirm: "admin:course:create:confirm",
  });
}

function setStateAndPreview(
  ctx: BotContext,
  userId: number,
  state: ConversationState,
  payload: any,
  previewText: string,
  opts: { confirm: string }
) {
  return (async () => {
    await setState(userId, state, payload);
    const kb = new InlineKeyboard()
      .text("✅ Создать", opts.confirm)
      .row()
      .text("✏️ Изменить", "restart:current")
      .row()
      .text("❌ Отмена", "cancel:current");
    await replyText(ctx, previewText, kb);
  })();
}

/* ------------------------------------------------------------------ */
/* Course items management (existing courses)                          */
/* ------------------------------------------------------------------ */

export async function handleAdminCourseItemsAdd(ctx: BotContext, courseId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const activeProducts = await getAllProducts(false);
  const available = activeProducts.filter((p) => p.isActive);
  if (available.length === 0) {
    await answerAlert(ctx, "❌ Нет доступных товаров.");
    return;
  }

  const kb = new InlineKeyboard();
  available.forEach((p, i) => {
    kb.text(`${p.name.length > 30 ? p.name.slice(0, 30) + "…" : p.name}`, `admin:course:additem:${courseId}:${p.id}`);
    if (i % 2 === 1) kb.row();
  });
  if (available.length % 2 !== 0) kb.row();
  kb.text("⬅️ Назад", `admin:course:view:${courseId}`);

  await editText(ctx, `📦 <b>Выберите товар для добавления в курс #${courseId}:</b>`, kb);
}

export async function handleAdminAddCourseItem(ctx: BotContext, courseId: number, productId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  await setState(dbUser.id, ConversationState.WAITING_COURSE_ITEMS, {
    editCourseId: courseId,
    addingProductId: productId,
  });
  await replyText(ctx, `Введите <b>количество</b> товара в комплекте:`);
}

export async function handleAdminAddCourseItemConfirm(ctx: BotContext, courseId: number) {
  if (!isAdminUser(ctx)) return;
  await editText(ctx, "✅ Состав курса обновлён.");
  return handleAdminCourseView(ctx, courseId);
}

export async function handleAdminCourseItemsList(ctx: BotContext, courseId: number) {
  if (!isAdminUser(ctx)) return;
  const course = await getCourseById(courseId);
  if (!course) {
    await answerAlert(ctx, "❌ Курс не найден.");
    return;
  }

  const kb = new InlineKeyboard();
  const lines = course.items.map((i) => {
    kb.text(`🗑 Убрать ${i.product.name}`, `admin:course:remitem:${courseId}:${i.productId}`);
    kb.row();
    return `• ${i.product.name} × ${i.quantity}`;
  });
  kb.text("➕ Добавить товар", `admin:course:items:add:${courseId}`);
  kb.row();
  kb.text("⬅️ Назад", `admin:course:view:${courseId}`);

  await editText(ctx, [`📚 <b>СОСТАВ КУРСА «${course.name}»</b>`, "", ...lines].join("\n"), kb);
}

export async function handleAdminRemoveCourseItem(ctx: BotContext, courseId: number, productId: number) {
  if (!isAdminUser(ctx)) return;
  await removeCourseItem(courseId, productId);
  await answerAlert(ctx, "✅ Товар убран из курса.");
  return handleAdminCourseItemsList(ctx, courseId);
}

/* ------------------------------------------------------------------ */
/* Edit flows                                                          */
/* ------------------------------------------------------------------ */

export async function handleAdminProductEdit(ctx: BotContext, field: string, productId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const stateMap: Record<string, ConversationState> = {
    name: ConversationState.WAITING_PRODUCT_NAME,
    price: ConversationState.WAITING_PRODUCT_PRICE,
    description: ConversationState.WAITING_PRODUCT_DESCRIPTION,
    category: ConversationState.WAITING_PRODUCT_CATEGORY,
    stock: ConversationState.WAITING_PRODUCT_STOCK,
    image: ConversationState.WAITING_PRODUCT_IMAGE,
  };
  const prompts: Record<string, string> = {
    name: `✏️ Введите новое <b>название</b>:`,
    price: `✏️ Введите новую <b>цену</b> (тенге):`,
    description: `✏️ Введите новое <b>описание</b> (или «-» для пустого):`,
    category: `✏️ Выберите новую <b>категорию</b>:`,
    stock: `✏️ Введите новое <b>количество</b> на складе:`,
    image: `🖼 Отправьте новое фото товара или «🚫 Без фото»:`,
  };

  await setState(dbUser.id, stateMap[field], { editProductId: productId });

  if (field === "category") {
    const categories = await getActiveCategories();
    const kb = new InlineKeyboard();
    categories.forEach((c, i) => {
      kb.text(c.name, `admin:product:create:cat:${c.id}`);
      if (i % 2 === 1) kb.row();
    });
    if (categories.length % 2 !== 0) kb.row();
    kb.text("⬅️ Отмена", "cancel:current");
    await editText(ctx, prompts.category, kb);
    return;
  }

  if (field === "image") {
    await editText(
      ctx,
      prompts.image,
      new InlineKeyboard()
        .text("🚫 Без фото", "admin:product:create:noimage")
        .row()
        .text("⬅️ Отмена", "cancel:current")
    );
    return;
  }

  await replyText(ctx, prompts[field]);
}

export async function handleAdminCategoryEdit(ctx: BotContext, field: string, categoryId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const stateMap: Record<string, ConversationState> = {
    name: ConversationState.WAITING_CATEGORY_NAME,
    description: ConversationState.WAITING_CATEGORY_DESCRIPTION,
    image: ConversationState.WAITING_CATEGORY_IMAGE,
  };
  const prompts: Record<string, string> = {
    name: `✏️ Введите новое <b>название</b>:`,
    description: `✏️ Введите новое <b>описание</b> (или «-» для пустого):`,
    image: `🖼 Отправьте новое фото категории или «🚫 Без фото»:`,
  };

  await setState(dbUser.id, stateMap[field], { editCategoryId: categoryId });

  if (field === "image") {
    await editText(
      ctx,
      prompts.image,
      new InlineKeyboard()
        .text("🚫 Без фото", "admin:category:create:noimage")
        .row()
        .text("⬅️ Отмена", "cancel:current")
    );
    return;
  }
  await replyText(ctx, prompts[field]);
}

export async function handleAdminCourseEdit(ctx: BotContext, field: string, courseId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const stateMap: Record<string, ConversationState> = {
    name: ConversationState.WAITING_COURSE_NAME,
    description: ConversationState.WAITING_COURSE_DESCRIPTION,
    price: ConversationState.WAITING_COURSE_PRICE,
    image: ConversationState.WAITING_COURSE_IMAGE,
  };
  const prompts: Record<string, string> = {
    name: `✏️ Введите новое <b>название</b>:`,
    description: `✏️ Введите новое <b>описание</b> (или «-» для пустого):`,
    price: `✏️ Введите новую <b>цену</b> (тенге):`,
    image: `🖼 Отправьте новое фото курса или «🚫 Без фото»:`,
  };

  await setState(dbUser.id, stateMap[field], { editCourseId: courseId });

  if (field === "image") {
    await editText(
      ctx,
      prompts.image,
      new InlineKeyboard()
        .text("🚫 Без фото", "admin:course:create:noimage")
        .row()
        .text("⬅️ Отмена", "cancel:current")
    );
    return;
  }
  await replyText(ctx, prompts[field]);
}

/* ------------------------------------------------------------------ */
/* Admin text wizard                                                   */
/* ------------------------------------------------------------------ */

export async function processAdminText(ctx: BotContext, state: any, text: string) {
  if (!state || !ctx.state.user || !ctx.message) return;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return;

  const payload: any = { ...((state.payload ?? {}) as any) };
  const value = text.trim();

  switch (state.state) {
    /* ---- Product ---- */
    case ConversationState.WAITING_PRODUCT_NAME: {
      const v = validateName(value, "Название");
      if (!v.ok) return answerAlert(ctx, v.error);
      if (payload.editProductId) {
        await updateProduct(Number(payload.editProductId), { name: v.value });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Название обновлено.");
        return handleAdminProductView(ctx, Number(payload.editProductId));
      }
      payload.name = v.value;
      await setState(dbUser.id, ConversationState.WAITING_PRODUCT_PRICE, payload);
      await replyText(ctx, `2️⃣ Введите <b>цену</b> товара (тенге):`);
      return;
    }

    case ConversationState.WAITING_PRODUCT_PRICE: {
      const v = validatePrice(value, "Цена");
      if (!v.ok) return answerAlert(ctx, v.error);
      if (payload.editProductId) {
        await updateProduct(Number(payload.editProductId), { price: v.value });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Цена обновлена.");
        return handleAdminProductView(ctx, Number(payload.editProductId));
      }
      payload.price = v.value;
      await setState(dbUser.id, ConversationState.WAITING_PRODUCT_DESCRIPTION, payload);
      await replyText(ctx, `3️⃣ Введите <b>описание</b> (или «-» для пустого):`);
      return;
    }

    case ConversationState.WAITING_PRODUCT_DESCRIPTION: {
      payload.description = value === "-" || value === "—" || value.toLowerCase() === "skip" ? null : value;
      if (payload.editProductId) {
        await updateProduct(Number(payload.editProductId), { description: payload.description });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Описание обновлено.");
        return handleAdminProductView(ctx, Number(payload.editProductId));
      }
      await setState(dbUser.id, ConversationState.WAITING_PRODUCT_CATEGORY, payload);
      const categories = await getActiveCategories();
      const kb = new InlineKeyboard();
      categories.forEach((c, i) => {
        kb.text(c.name, `admin:product:create:cat:${c.id}`);
        if (i % 2 === 1) kb.row();
      });
      if (categories.length % 2 !== 0) kb.row();
      kb.text("⬅️ Отмена", "cancel:current");
      await replyText(ctx, `4️⃣ Выберите <b>категорию</b>:`, kb);
      return;
    }

    case ConversationState.WAITING_PRODUCT_STOCK: {
      const v = validateQuantity(value, "Количество");
      if (!v.ok) return answerAlert(ctx, v.error);
      if (payload.editProductId) {
        await updateProduct(Number(payload.editProductId), { stock: v.value });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Остаток обновлён.");
        return handleAdminProductView(ctx, Number(payload.editProductId));
      }
      payload.stock = v.value;
      await setState(dbUser.id, ConversationState.WAITING_PRODUCT_IMAGE, payload);
      await replyText(
        ctx,
        `6️⃣ Отправьте <b>изображение</b> товара или нажмите «Без фото»:`,
        new InlineKeyboard()
          .text("🚫 Без фото", "admin:product:create:noimage")
          .row()
          .text("❌ Отмена", "cancel:current")
      );
      return;
    }

    case ConversationState.WAITING_PRODUCT_IMAGE:
      return;

    /* ---- Category ---- */
    case ConversationState.WAITING_CATEGORY_NAME: {
      const v = validateName(value, "Название");
      if (!v.ok) return answerAlert(ctx, v.error);
      if (payload.editCategoryId) {
        await updateCategory(Number(payload.editCategoryId), { name: v.value });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Название обновлено.");
        return handleAdminCategoryView(ctx, Number(payload.editCategoryId));
      }
      payload.name = v.value;
      await setState(dbUser.id, ConversationState.WAITING_CATEGORY_DESCRIPTION, payload);
      await replyText(ctx, `2️⃣ Введите <b>описание</b> категории (или «-» для пустого):`);
      return;
    }

    case ConversationState.WAITING_CATEGORY_DESCRIPTION: {
      payload.description = value === "-" || value === "—" || value.toLowerCase() === "skip" ? null : value;
      if (payload.editCategoryId) {
        await updateCategory(Number(payload.editCategoryId), { description: payload.description });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Описание обновлено.");
        return handleAdminCategoryView(ctx, Number(payload.editCategoryId));
      }
      await setState(dbUser.id, ConversationState.WAITING_CATEGORY_IMAGE, payload);
      await replyText(
        ctx,
        `3️⃣ Отправьте <b>изображение</b> категории или нажмите «Без фото»:`,
        new InlineKeyboard()
          .text("🚫 Без фото", "admin:category:create:noimage")
          .row()
          .text("❌ Отмена", "cancel:current")
      );
      return;
    }

    case ConversationState.WAITING_CATEGORY_IMAGE:
      return;

    /* ---- Course ---- */
    case ConversationState.WAITING_COURSE_NAME: {
      const v = validateName(value, "Название");
      if (!v.ok) return answerAlert(ctx, v.error);
      if (payload.editCourseId) {
        await updateCourse(Number(payload.editCourseId), { name: v.value });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Название обновлено.");
        return handleAdminCourseView(ctx, Number(payload.editCourseId));
      }
      payload.name = v.value;
      await setState(dbUser.id, ConversationState.WAITING_COURSE_DESCRIPTION, payload);
      await replyText(ctx, `2️⃣ Введите <b>описание</b> курса (или «-» для пустого):`);
      return;
    }

    case ConversationState.WAITING_COURSE_DESCRIPTION: {
      payload.description = value === "-" || value === "—" || value.toLowerCase() === "skip" ? null : value;
      if (payload.editCourseId) {
        await updateCourse(Number(payload.editCourseId), { description: payload.description });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Описание обновлено.");
        return handleAdminCourseView(ctx, Number(payload.editCourseId));
      }
      payload.name = payload.name ?? "";
      await setState(dbUser.id, ConversationState.WAITING_COURSE_PRICE, payload);
      await replyText(ctx, `3️⃣ Введите <b>цену</b> курса (тенге):`);
      return;
    }

    case ConversationState.WAITING_COURSE_PRICE: {
      const v = validatePrice(value, "Цена");
      if (!v.ok) return answerAlert(ctx, v.error);
      if (payload.editCourseId) {
        await updateCourse(Number(payload.editCourseId), { price: v.value });
        await resetState(dbUser.id);
        await editText(ctx, "✅ Цена обновлена.");
        return handleAdminCourseView(ctx, Number(payload.editCourseId));
      }
      payload.price = v.value;
      await setState(dbUser.id, ConversationState.WAITING_COURSE_ITEMS, payload);
      await replyText(
        ctx,
        `4️⃣ Добавьте товары в курс:`,
        new InlineKeyboard()
          .text("➕ Добавить товар", "admin:course:create:additem")
          .row()
          .text("✅ Завершить состав", "admin:course:create:itemconfirm")
      );
      return;
    }

    case ConversationState.WAITING_COURSE_ITEMS: {
      const quantity = parseInt(value, 10);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        return answerAlert(ctx, "Введите целое число от 1 до 100.");
      }

      const productId = Number(payload.addingProductId);
      if (!productId) return answerAlert(ctx, "Сначала выберите товар.");
      const product = await getProductById(productId);

      const items: any[] = (payload.items ?? []).filter((i: any) => Number(i.productId) !== productId);
      items.push({ productId, productName: product?.name ?? `Товар #${productId}`, quantity });
      payload.items = items;
      delete payload.addingProductId;

      if (payload.editCourseId) {
        await addCourseItem(Number(payload.editCourseId), productId, quantity);
        await resetState(dbUser.id);
        return handleAdminCourseView(ctx, Number(payload.editCourseId));
      }

      await setState(dbUser.id, ConversationState.WAITING_COURSE_ITEMS, payload);
      const comp = items.map((i: any) => `• ${i.productName} × ${i.quantity}`).join("\n");
      await replyText(
        ctx,
        `Товар добавлен.\n\n📦 <b>Состав:</b>\n${comp}\n\nПродолжить?`,
        new InlineKeyboard()
          .text("➕ Добавить ещё товар", "admin:course:create:additem")
          .row()
          .text("✅ Завершить состав", "admin:course:create:itemconfirm")
          .row()
          .text("❌ Отмена", "cancel:current")
      );
      return;
    }

    case ConversationState.WAITING_COURSE_IMAGE:
      return;

    /* ---- Reject reason ---- */
    case ConversationState.WAITING_REJECT_REASON: {
      const rejectOrderId = Number(payload.rejectOrderId);
      if (!rejectOrderId) {
        await resetState(dbUser.id);
        return answerAlert(ctx, "Ошибка. Попробуйте ещё раз.");
      }
      if (value.length < 2 || value.length > 300) {
        return answerAlert(ctx, "Причина должна быть от 2 до 300 символов.");
      }
      const result = await rejectOrderPayment(rejectOrderId, value);
      if (!result.ok || !result.order) {
        await resetState(dbUser.id);
        return answerAlert(ctx, userFriendlyError(result.error ?? "GENERIC"));
      }
      await resetState(dbUser.id);
      const order = result.order;

      await getBot()
        .api.sendMessage(
          order.user.telegramId.toString(),
          [
            `❌ <b>Оплата не подтверждена.</b>`,
            ``,
            `Заказ №${order.id}`,
            ``,
            `Причина:`,
            value,
            ``,
            `Пожалуйста, отправьте новый чек.`,
          ].join("\n"),
          {
            parse_mode: "HTML",
            reply_markup: new InlineKeyboard().text("📎 Отправить новый чек", `order:view:${order.id}`),
          }
        )
        .catch(() => {});

      await setState(order.userId, ConversationState.WAITING_RECEIPT, { orderId: order.id });

      await editText(ctx, `✅ Оплата заказа #${order.id} отклонена.`);
      return;
    }

    default:
      return;
  }
}

/* ------------------------------------------------------------------ */
/* Admin photo handlers                                                */
/* ------------------------------------------------------------------ */

export async function processAdminPhoto(ctx: BotContext): Promise<boolean> {
  if (!ctx.state.user || !ctx.message?.photo) return false;
  const user = ctx.state.user;
  const dbUser = await getUserByTelegramId(user.telegramId);
  if (!dbUser) return false;

  const state = await getState(dbUser.id);
  if (!state) return false;
  const payload: any = { ...((state.payload ?? {}) as any) };

  let keyPrefix = "";
  if (state.state === ConversationState.WAITING_PRODUCT_IMAGE) keyPrefix = "products";
  else if (state.state === ConversationState.WAITING_CATEGORY_IMAGE) keyPrefix = "categories";
  else if (state.state === ConversationState.WAITING_COURSE_IMAGE) keyPrefix = "courses";
  else return false;

  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    let url: string | null = null;
    try {
      const file = await getBot().api.getFile(photo.file_id);
      const buffer = await downloadFile(file.file_path!);
      ({ url } = await uploadFile(keyPrefix, `image_${Date.now()}.jpg`, buffer, "image/jpeg"));
    } catch (e: any) {
      if (e?.message === "STORAGE_NOT_CONFIGURED") {
        url = `tg:${photo.file_id}`;
      } else throw e;
    }
    payload.imageUrl = url;

    if (payload.editProductId) {
      await updateProduct(Number(payload.editProductId), { imageUrl: url });
      await resetState(dbUser.id);
      await editText(ctx, "✅ Изображение обновлено.");
      await handleAdminProductView(ctx, Number(payload.editProductId));
      return true;
    }
    if (payload.editCategoryId) {
      await updateCategory(Number(payload.editCategoryId), { imageUrl: url });
      await resetState(dbUser.id);
      await editText(ctx, "✅ Изображение обновлено.");
      await handleAdminCategoryView(ctx, Number(payload.editCategoryId));
      return true;
    }
    if (payload.editCourseId) {
      await updateCourse(Number(payload.editCourseId), { imageUrl: url });
      await resetState(dbUser.id);
      await editText(ctx, "✅ Изображение обновлено.");
      await handleAdminCourseView(ctx, Number(payload.editCourseId));
      return true;
    }

    if (state.state === ConversationState.WAITING_PRODUCT_IMAGE) { await showProductPreview(ctx, dbUser.id, payload); return true; }
    if (state.state === ConversationState.WAITING_CATEGORY_IMAGE) { await showCategoryPreview(ctx, dbUser.id, payload); return true; }
    if (state.state === ConversationState.WAITING_COURSE_IMAGE) { await showCoursePreview(ctx, dbUser.id, payload); return true; }
    return true;
  } catch (e) {
    await replyText(ctx, "⚠️ Не удалось сохранить изображение.");
    return true;
  }
}

export async function processAdminDocument(ctx: BotContext): Promise<boolean> {
  return false;
}

async function downloadFile(filePath: string): Promise<Buffer> {
  const token = process.env.BOT_TOKEN!;
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("DOWNLOAD_FAILED");
  return Buffer.from(await res.arrayBuffer());
}

/* ------------------------------------------------------------------ */
/* Orders & payments                                                   */
/* ------------------------------------------------------------------ */

const PAGE_SIZE = 5;

export async function handleAdminOrderListByFilter(ctx: BotContext, filter: string, page = 0) {
  if (!isAdminUser(ctx)) return;
  const { getAllOrders: listOrders, countOrders } = await import("../../services/order.service");

  const statusArg: any = filter === "all" ? undefined : filter;
  const [orders, total] = await Promise.all([
    listOrders(statusArg, page * PAGE_SIZE, PAGE_SIZE),
    countOrders(statusArg),
  ]);

  if (orders.length === 0 && page === 0) {
    await editText(ctx, "🛒 По этому фильтру заказов нет.", adminOrdersKeyboard());
    return;
  }

  const kb = new InlineKeyboard();
  const lines = orders.map((o) => {
    kb.text(`№${o.id} • ${formatPrice(Number(o.total))}`, `order:view:${o.id}`);
    kb.row();
    return `№${o.id} • ${formatPrice(Number(o.total))} • ${o.status}`;
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const text = [
    `🛒 <b>ЗАКАЗЫ</b> — ${filter === "all" ? "все" : filter}`,
    ``,
    ...lines,
    ``,
    `📄 Страница ${page + 1} из ${totalPages} • Всего: ${total}`,
  ].join("\n");

  if (page > 0) kb.text("⬅️", `admin:order:list:${filter}:${page - 1}`);
  kb.text("☰", `admin:order:list:${filter}:${page}`);
  if (orders.length >= PAGE_SIZE && (page + 1) * PAGE_SIZE < total) {
    kb.text("➡️", `admin:order:list:${filter}:${page + 1}`);
  }
  kb.row();
  kb.text("⬅️ Назад", "admin:orders");
  await editText(ctx, text, kb);
}

export async function handleAdminOrderStatus(ctx: BotContext, orderId: number) {
  if (!isAdminUser(ctx)) return;
  const order = await getOrderById(orderId);
  if (!order) {
    await answerAlert(ctx, "❌ Заказ не найден.");
    return;
  }
  const kb = new InlineKeyboard()
    .text("❌ Отменён", `admin:order:setstatus:cancelled:${orderId}`)
    .row()
    .text("🚚 Отправлен", `admin:order:setstatus:shipped:${orderId}`)
    .row()
    .text("✅ Выполнен", `admin:order:setstatus:completed:${orderId}`)
    .row()
    .text("🔵 В обработке", `admin:order:setstatus:processing:${orderId}`)
    .row()
    .text("⬅️ Назад", `order:view:${orderId}`);
  await editText(ctx, `🛒 <b>ЗАКАЗ №${orderId}</b>\n\nВыберите новый статус:`, kb);
}

export async function handleAdminOrderSetStatus(ctx: BotContext, status: string, orderId: number) {
  if (!isAdminUser(ctx)) return;
  const validStatuses = ["pending_payment", "pending_verification", "paid", "processing", "shipped", "completed", "cancelled"];
  if (!validStatuses.includes(status)) return answerAlert(ctx, "❌ Недопустимый статус.");

  const order = await getOrderById(orderId);
  if (!order) return answerAlert(ctx, "❌ Заказ не найден.");

  await changeOrderStatus(orderId, status as any);
  await notifyUserOrderStatus(order.user.telegramId, orderId, status);
  await answerAlert(ctx, "✅ Статус обновлён.");
  const { handleOrderView } = await import("./orders");
  return handleOrderView(ctx, orderId);
}

async function notifyUserOrderStatus(telegramId: bigint, orderId: number, statusLabel: string) {
  const labels: Record<string, string> = {
    pending_payment: "ожидает оплаты",
    pending_verification: "ожидает проверки",
    paid: "оплачен",
    processing: "в обработке",
    shipped: "отправлен",
    completed: "завершён",
    cancelled: "отменён",
  };
  try {
    await getBot().api.sendMessage(
      telegramId.toString(),
      `📦 Статус вашего заказа №${orderId}: <b>${labels[statusLabel] ?? statusLabel}</b>`,
      { parse_mode: "HTML" }
    );
  } catch (e) {}
}

export async function handleAdminPaymentList(ctx: BotContext, statusFilter: string) {
  if (!isAdminUser(ctx)) return;
  const payments = await getPaymentsByStatus(statusFilter as any);
  if (payments.length === 0) {
    await editText(ctx, "💳 По этому фильтру оплат нет.", adminPaymentsKeyboard());
    return;
  }
  const kb = new InlineKeyboard();
  const lines = payments.slice(0, 10).map((p) => {
    kb.text(`Заказ №${p.orderId}`, `order:view:${p.orderId}`);
    kb.row();
    return `Заказ #${p.orderId} • ${formatPrice(Number(p.amount))} • ${p.createdAt.toLocaleDateString("ru-RU")}`;
  });
  kb.text("⬅️ Назад", "admin:payments");
  await editText(ctx, [`💳 <b>ОПЛАТЫ</b>`, "", ...lines].join("\n"), kb);
}

export async function handleAdminPaymentConfirm(ctx: BotContext, orderId: number) {
  if (!isAdminUser(ctx)) return;
  const result = await confirmOrderPayment(orderId);
  if (!result.ok || !result.order) {
    return answerAlert(ctx, userFriendlyError(result.error ?? "GENERIC"));
  }
  const order = result.order;

  await getBot()
    .api.sendMessage(
      order.user.telegramId.toString(),
      `✅ <b>Оплата подтверждена!</b>\n\nЗаказ №${orderId} принят в обработку.`,
      { parse_mode: "HTML" }
    )
    .catch(() => {});

  await notifyAdminOrderPaid(getBot(), order);
  await editText(ctx, `✅ Оплата заказа №${orderId} подтверждена.\n\nСтатус: <b>В обработке</b>`);
}

export async function handleAdminPaymentReject(ctx: BotContext, orderId: number) {
  if (!isAdminUser(ctx)) return;
  if (!ctx.state.user) return;
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;

  const order = await getOrderById(orderId);
  if (!order) return answerAlert(ctx, "❌ Заказ не найден.");
  if (order.paymentStatus === "paid") return answerAlert(ctx, userFriendlyError("ALREADY_PAID"));

  await setState(dbUser.id, ConversationState.WAITING_REJECT_REASON, { rejectOrderId: orderId });
  await replyText(ctx, `❌ Введите <b>причину отклонения</b> оплаты заказа №${orderId}:`);
}

export async function handleAdminReceipt(ctx: BotContext, orderId: number) {
  if (!isAdminUser(ctx)) return;
  const order = await getOrderById(orderId);
  if (!order) return answerAlert(ctx, "❌ Заказ не найден.");
  if (!order.receiptUrl && !order.receiptFileId) return answerAlert(ctx, "❌ Чек не загружен.");

  if (order.receiptFileId && !order.receiptUrl && ctx.from) {
    const fileCaption = `🧾 <b>ЧЕК ЗАКАЗА №${order.id}</b>`;
    const api = getBot().api;
    const sendPhoto = (mime?: string) =>
      mime?.startsWith("image/")
        ? api.sendPhoto(ctx.from!.id, order.receiptFileId!, {
            caption: fileCaption,
            parse_mode: "HTML",
          })
        : api.sendDocument(ctx.from!.id, order.receiptFileId!, {
            caption: fileCaption,
            parse_mode: "HTML",
          });
    try {
      await sendPhoto(order.receiptMimeType ?? undefined).catch(() =>
        api.sendDocument(ctx.from!.id, order.receiptFileId!, {
          caption: fileCaption,
          parse_mode: "HTML",
        })
      );
    } catch (e) {
      console.error("failed to send receipt file", e);
      return answerAlert(ctx, "❌ Не удалось отправить чек.");
    }
  }

  const kb = new InlineKeyboard()
    .text("👁 Смотреть чек", `admin:receipt:show:${orderId}`)
    .row()
    .text("✅ Подтвердить оплату", `admin:payment:confirm:${orderId}`)
    .row()
    .text("❌ Отклонить оплату", `admin:payment:reject:${orderId}`)
    .row()
    .text("⬅️ Назад", "admin:orders");

  await editText(ctx, `🧾 <b>ЧЕК ЗАКАЗА №${order.id}</b>\n\n${order.receiptUrl ? "Чек доступен по ссылке ниже." : "Чек отправлен выше."}`, kb);
}