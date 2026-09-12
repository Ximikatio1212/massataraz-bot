import { z } from "zod";
import { t } from "../i18n";

export const priceSchema = z
  .string()
  .trim()
  .transform((v) => Number(v.replace(/\s/g, "").replace(/,/g, ".")))
  .refine((v) => !isNaN(v) && v > 0, {
    message: "Цена должна быть положительным числом",
  });

export const quantitySchema = z
  .string()
  .trim()
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v) && v >= 0 && v <= 100000, {
    message: "Количество должно быть целым числом от 0 до 100000",
  });

export const cartQuantitySchema = z
  .string()
  .trim()
  .transform((v) => Number(v))
  .refine((v) => Number.isInteger(v) && v >= 1 && v <= 100, {
    message: "Количество должно быть целым числом от 1 до 100",
  });

export const phoneSchema = z
  .string()
  .trim()
  .min(7, "Номер телефона слишком короткий")
  .max(20, "Номер телефона слишком длинный")
  .refine(
    (v) => /^[+\d][\d\s\-()]{6,}$/.test(v),
    "Введите корректный номер телефона"
  );

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Слишком короткое имя")
  .max(100, "Слишком длинное имя");

export const addressSchema = z
  .string()
  .trim()
  .min(3, "Слишком короткий адрес")
  .max(300, "Слишком длинный адрес");

export function validatePrice(input: string, fieldLabel: string): { ok: true; value: number } | { ok: false; error: string } {
  const result = priceSchema.safeParse(input);
  if (!result.success) {
    return { ok: false, error: `${fieldLabel}: ${result.error.issues[0].message}` };
  }
  return { ok: true, value: Math.round(result.data * 100) / 100 };
}

export function validateQuantity(input: string, fieldLabel: string): { ok: true; value: number } | { ok: false; error: string } {
  const result = quantitySchema.safeParse(input);
  if (!result.success) {
    return { ok: false, error: `${fieldLabel}: ${result.error.issues[0].message}` };
  }
  return { ok: true, value: result.data };
}

export function validateName(
  input: string,
  fieldLabel: string,
  lang?: string
): { ok: true; value: string } | { ok: false; error: string } {
  const result = nameSchema.safeParse(input);
  if (!result.success) {
    const msg =
      result.error.issues[0].message === "Слишком короткое имя"
        ? t(lang, "name_short")
        : t(lang, "name_long");
    return { ok: false, error: `${fieldLabel}: ${msg}` };
  }
  return { ok: true, value: result.data };
}

export function validatePhone(
  input: string,
  lang?: string
): { ok: true; value: string } | { ok: false; error: string } {
  const v = input.trim();
  if (v.length < 7) return { ok: false, error: t(lang, "phone_short") };
  if (v.length > 20) return { ok: false, error: t(lang, "phone_long") };
  if (!/^[+\d][\d\s\-()]{6,}$/.test(v)) return { ok: false, error: t(lang, "phone_invalid") };
  return { ok: true, value: v };
}

export function validateAddress(
  input: string,
  lang?: string
): { ok: true; value: string } | { ok: false; error: string } {
  const v = input.trim();
  if (v.length < 3) return { ok: false, error: t(lang, "addr_short") };
  if (v.length > 300) return { ok: false, error: t(lang, "addr_long") };
  return { ok: true, value: v };
}

const postalRegex = /^[A-Za-z0-9][A-Za-z0-9\-\s]{0,9}$/;

export function validatePostal(
  input: string,
  lang?: string
): { ok: true; value: string } | { ok: false; error: string } {
  const v = input.trim();
  if (v.length < 3 || v.length > 10) return { ok: false, error: t(lang, "postal_invalid") };
  if (!postalRegex.test(v)) return { ok: false, error: t(lang, "postal_invalid") };
  return { ok: true, value: v };
}