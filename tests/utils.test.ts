import test from "node:test";
import assert from "node:assert/strict";
import { formatPrice, truncate } from "../src/utils/formatting";
import { userFriendlyError } from "../src/utils/errors";
import { validatePrice, validateQuantity, validateName, phoneSchema, addressSchema } from "../src/utils/validation";

test("formatPrice: рубли/теньге с разделителями", () => {
  assert.equal(formatPrice(1000), "1\u00A0000 ₸");
  assert.equal(formatPrice("2500"), "2\u00A0500 ₸");
  assert.equal(formatPrice("abc"), "0 ₸");
  assert.equal(formatPrice(0), "0 ₸");
});

test("truncate: обрезает длинные строки", () => {
  assert.equal(truncate("abcdefghij", 6), "abc...");
  assert.equal(truncate("short", 10), "short");
});

test("userFriendlyError: известный и неизвестный код", () => {
  assert.equal(userFriendlyError("CART_EMPTY"), "🛒 Корзина пуста.");
  assert.equal(userFriendlyError("UNKNOWN_CODE"), "⚠️ Что-то пошло не так. Попробуйте ещё раз.");
});

test("validatePrice: принимает «1 500,50» и отдаёт 1500.5", () => {
  const r = validatePrice("1 500,50", "Цена");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, 1500.5);
});

test("validatePrice: отклоняет 0 и отрицательные", () => {
  assert.equal(validatePrice("0", "Цена").ok, false);
  assert.equal(validatePrice("-5", "Цена").ok, false);
});

test("validateQuantity: целые числа от 0 до 100000", () => {
  assert.equal(validateQuantity("5", "Остаток").ok, true);
  assert.equal(validateQuantity("-1", "Остаток").ok, false);
  assert.equal(validateQuantity("1.5", "Остаток").ok, false);
});

test("validateName: триммит и проверяет длину", () => {
  const r = validateName("  Иван   ", "ФИО");
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value, "Иван");
  assert.equal(validateName("И", "ФИО").ok, false);
});

test("phoneSchema: валидные и невалидные номера", () => {
  assert.equal(phoneSchema.safeParse("+7 700 123 45 67").success, true);
  assert.equal(phoneSchema.safeParse("87001234567").success, true);
  assert.equal(phoneSchema.safeParse("abc").success, false);
});

test("addressSchema: валидный адрес", () => {
  assert.equal(addressSchema.safeParse("г. Алматы, ул. Абая 10").success, true);
  assert.equal(addressSchema.safeParse("к").success, false);
});

test("verifyWebhookSecret: постоянное сравнение секрета", () => {
  process.env.DATABASE_URL = "postgresql://x:x@localhost:5432/x";
  process.env.WEBHOOK_SECRET = "test-secret-123";
  const { verifyWebhookSecret } = require("../src/services/webhook.service");
  assert.equal(verifyWebhookSecret("test-secret-123"), true);
  assert.equal(verifyWebhookSecret("wrong-secret"), false);
  assert.equal(verifyWebhookSecret(undefined), false);
  delete process.env.WEBHOOK_SECRET;
  assert.equal(verifyWebhookSecret(undefined), true); // без настройки — не блокируем
});