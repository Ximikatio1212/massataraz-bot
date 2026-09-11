import { InlineKeyboard } from "grammy";

export function adminProductsKeyboard() {
  return new InlineKeyboard()
    .text("➕ Добавить товар", "admin:product:create:start")
    .row()
    .text("📋 Список товаров", "admin:product:list")
    .row()
    .text("✏️ Изменить товар", "admin:product:edit:menu")
    .row()
    .text("🔴 Скрытые товары", "admin:product:hidden")
    .row()
    .text("⬅️ Назад", "admin:menu");
}

export function adminCategoriesKeyboard() {
  return new InlineKeyboard()
    .text("➕ Создать категорию", "admin:category:create:start")
    .row()
    .text("📋 Список категорий", "admin:category:list")
    .row()
    .text("🔴 Скрытые категории", "admin:category:hidden")
    .row()
    .text("⬅️ Назад", "admin:menu");
}

export function adminCoursesKeyboard() {
  return new InlineKeyboard()
    .text("➕ Создать курс", "admin:course:create:start")
    .row()
    .text("📋 Список курсов", "admin:course:list")
    .row()
    .text("🔴 Скрытые курсы", "admin:course:hidden")
    .row()
    .text("⬅️ Назад", "admin:menu");
}

export function adminOrdersKeyboard() {
  return new InlineKeyboard()
    .text("📋 Все заказы", "admin:order:list:all")
    .row()
    .text("🟡 На проверке", "admin:order:list:pending_verification")
    .row()
    .text("🔵 В обработке", "admin:order:list:processing")
    .row()
    .text("🚚 Отправлены", "admin:order:list:shipped")
    .row()
    .text("✅ Завершены", "admin:order:list:completed")
    .row()
    .text("🧹 Очистить историю", "admin:order:clear:completed")
    .row()
    .text("⬅️ Назад", "admin:menu");
}

export function adminPaymentsKeyboard() {
  return new InlineKeyboard()
    .text("🟡 Ожидают проверки", "admin:payment:list:pending_verification")
    .row()
    .text("✅ Подтверждённые", "admin:payment:list:paid")
    .row()
    .text("❌ Отклонённые", "admin:payment:list:rejected")
    .row()
    .text("⬅️ Назад", "admin:menu");
}

export function adminClientsKeyboard(offset = 0) {
  const kb = new InlineKeyboard();
  if (offset > 0) {
    kb.text("⬅️ Назад", `admin:client:list:${Math.max(0, offset - 10)}`);
    kb.text("Вперёд ➡️", `admin:client:list:${offset + 10}`);
    kb.row();
  } else {
    kb.text("Вперёд ➡️", `admin:client:list:${offset + 10}`);
    kb.row();
  }
  kb.text("⬅️ Назад", "admin:menu");
  return kb;
}

export function adminProductListKeyboard(products: { id: number; name: string }[], offset = 0, pageSize = 10) {
  const kb = new InlineKeyboard();
  products.forEach((p) => {
    kb.text(p.name.length > 40 ? `${p.name.slice(0, 40)}…` : p.name, `admin:product:view:${p.id}`);
    kb.row();
  });
  if (offset > 0) {
    kb.text("⬅️", `admin:product:list:${Math.max(0, offset - pageSize)}`);
  }
  kb.text("Назад", "admin:products");
  if (products.length >= pageSize) {
    kb.text("➡️", `admin:product:list:${offset + pageSize}`);
  }
  return kb;
}

export function adminCategoryListKeyboard(categories: { id: number; name: string }[], offset = 0, pageSize = 10) {
  const kb = new InlineKeyboard();
  categories.forEach((c) => {
    kb.text(c.name.length > 40 ? `${c.name.slice(0, 40)}…` : c.name, `admin:category:view:${c.id}`);
    kb.row();
  });
  if (offset > 0) {
    kb.text("⬅️", `admin:category:list:${Math.max(0, offset - pageSize)}`);
  }
  kb.text("Назад", "admin:categories");
  if (categories.length >= pageSize) {
    kb.text("➡️", `admin:category:list:${offset + pageSize}`);
  }
  return kb;
}

export function adminCourseListKeyboard(courses: { id: number; name: string }[], offset = 0, pageSize = 10) {
  const kb = new InlineKeyboard();
  courses.forEach((c) => {
    kb.text(c.name.length > 40 ? `${c.name.slice(0, 40)}…` : c.name, `admin:course:view:${c.id}`);
    kb.row();
  });
  if (offset > 0) {
    kb.text("⬅️", `admin:course:list:${Math.max(0, offset - pageSize)}`);
  }
  kb.text("Назад", "admin:courses");
  if (courses.length >= pageSize) {
    kb.text("➡️", `admin:course:list:${offset + pageSize}`);
  }
  return kb;
}

export function adminProductManageKeyboard(productId: number) {
  return new InlineKeyboard()
    .text("✏️ Название", `admin:product:edit:name:${productId}`)
    .text("💰 Цена", `admin:product:edit:price:${productId}`)
    .row()
    .text("📝 Описание", `admin:product:edit:description:${productId}`)
    .text("📁 Категория", `admin:product:edit:category:${productId}`)
    .row()
    .text("📦 Остаток", `admin:product:edit:stock:${productId}`)
    .text("🖼 Изображение", `admin:product:edit:image:${productId}`)
    .row()
    .text("⬅️ Назад", "admin:products");
}

export function adminCategoryManageKeyboard(categoryId: number) {
  return new InlineKeyboard()
    .text("✏️ Название", `admin:category:edit:name:${categoryId}`)
    .row()
    .text("📝 Описание", `admin:category:edit:description:${categoryId}`)
    .row()
    .text("🖼 Изображение", `admin:category:edit:image:${categoryId}`)
    .row()
    .text("⬅️ Назад", "admin:categories");
}

export function adminCourseManageKeyboard(courseId: number) {
  return new InlineKeyboard()
    .text("✏️ Название", `admin:course:edit:name:${courseId}`)
    .row()
    .text("💰 Цена", `admin:course:edit:price:${courseId}`)
    .row()
    .text("📝 Описание", `admin:course:edit:description:${courseId}`)
    .row()
    .text("🖼 Изображение", `admin:course:edit:image:${courseId}`)
    .row()
    .text("➕ Добавить товар", `admin:course:items:add:${courseId}`)
    .row()
    .text("📋 Состав курса", `admin:course:items:list:${courseId}`)
    .row()
    .text("⬅️ Назад", "admin:courses");
}

export function adminToggleKeyboard(prefix: string, id: number, isActive: boolean) {
  const kb = new InlineKeyboard();
  if (isActive) {
    kb.text("🔴 Скрыть", `${prefix}:toggle:off:${id}`);
  } else {
    kb.text("🟢 Показать", `${prefix}:toggle:on:${id}`);
  }
  return kb;
}

export function adminOrderListKeyboard(orders: { id: number; total: number; status: string }[]) {
  const kb = new InlineKeyboard();
  orders.forEach((o) => {
    kb.text(`№${o.id} • ${o.total}₸`, `order:view:${o.id}`);
    kb.row();
  });
  kb.text("⬅️ Назад", "admin:orders");
  return kb;
}

export function paymentConfirmKeyboard(orderId: number) {
  return new InlineKeyboard()
    .text("✅ Подтвердить оплату", `admin:payment:confirm:${orderId}`)
    .row()
    .text("❌ Отклонить оплату", `admin:payment:reject:${orderId}`);
}

export function orderWithReceiptKeyboard(orderId: number) {
  return new InlineKeyboard().text("📎 Открыть чек", `admin:receipt:${orderId}`);
}