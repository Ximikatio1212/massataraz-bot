import { Context } from "grammy";

export const ERROR_MESSAGES: Record<string, string> = {
  PRODUCT_UNAVAILABLE: "❌ Товар недоступен.",
  PRODUCT_NO_STOCK: "❌ Товара сейчас нет в наличии.",
  PRODUCT_STOCK_LIMIT: "❌ Недостаточно товара на складе.",
  COURSE_UNAVAILABLE: "❌ Курс недоступен.",
  COURSE_EMPTY: "❌ Курс пуст, добавьте товары в курс.",
  COURSE_COMPONENT_UNAVAILABLE: "❌ Один из товаров курса недоступен.",
  COURSE_COMPONENT_NO_STOCK: "❌ Недостаточно товаров в составе курса на складе.",
  COURSE_STOCK_LIMIT: "❌ Недостаточно товаров для нужного количества курса.",
  CART_EMPTY: "🛒 Корзина пуста.",
  CART_ITEM_NOT_FOUND: "❌ Позиция в корзине не найдена.",
  ORDER_NOT_FOUND: "❌ Заказ не найден.",
  ALREADY_PAID: "✅ Оплата по этому заказу уже подтверждена.",
  ORDER_CANCELLED: "❌ Заказ отменён.",
  UPDATE_FAILED: "❌ Не удалось выполнить операцию. Попробуйте ещё раз.",
  STORAGE_NOT_CONFIGURED: "❌ Файловое хранилище не настроено. Обратитесь к администратору.",
  FILE_TOO_LARGE: "❌ Файл слишком большой (максимум 10 МБ).",
  INVALID_MIME_TYPE: "❌ Недопустимый тип файла.",
  INVALID_EXTENSION: "❌ Недопустимое расширение файла.",
  INVALID_FILE_TYPE: "❌ Недопустимый тип файла.",
  NOT_ADMIN: "⛔ Доступ запрещён.",
  GENERIC: "⚠️ Что-то пошло не так. Попробуйте ещё раз.",
};

export function userFriendlyError(code: string): string {
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.GENERIC;
}

export function logError(context: string, error: unknown, meta?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      ts: new Date().toISOString(),
      context,
      message,
      meta: meta ?? {},
    })
  );
}

export function safeCall(fn: () => Promise<void>): Promise<void> {
  return fn().catch((err) => {
    logError("safeCall", err);
  });
}