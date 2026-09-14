import type { Handler } from "@netlify/functions";
import { Prisma, ConversationState, OrderStatus } from "@prisma/client";

import { verifyWebAppInitData } from "../../src/utils/webapp";
import { prisma } from "../../src/db/prisma";
import { getOrCreateUser, getUserByTelegramId } from "../../src/services/user.service";
import {
  getActiveCategories,
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  toggleCategoryActive,
  deleteCategoryHard,
} from "../../src/services/category.service";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductActive,
  deleteProduct,
} from "../../src/services/product.service";
import {
  getActiveCourses,
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  toggleCourseActive,
  addCourseItem,
  removeCourseItem,
  deleteCourse,
} from "../../src/services/course.service";
import {
  getCart,
  validateCartForOrder,
  addProductToCart,
  addCourseToCart,
  increaseCartItem,
  decreaseCartItem,
  deleteCartItem,
  clearCart,
} from "../../src/services/cart.service";
import {
  createOrder,
  getOrderById,
  getUserOrders,
  updateOrder,
  completeReceiptSubmission,
  getAllOrders,
  changeOrderStatus,
  confirmOrderPayment,
  rejectOrderPayment,
  setOrderTrackNumber,
} from "../../src/services/order.service";
import { createPaymentRecord } from "../../src/services/payment.service";
import { getStatistics, getOrderCountsByStatus } from "../../src/services/statistics.service";
import { aiEnabled, handleAiChat, setAiMode } from "../../src/services/ai.service";
import {
  registerForTracking,
  getTrackingInfo,
  trackingLink,
  trackingEnabled,
} from "../../src/services/tracking.service";
import { uploadFile } from "../../src/services/storage.service";
import {
  notifyAdminsNewOrder,
  notifyAdminOrderPaid,
  notifyAdminOrderRejected,
} from "../../src/services/notifications.service";
import { userFriendlyError } from "../../src/utils/errors";
import { validateName, validateAddress, validatePostal, validatePhone } from "../../src/utils/validation";
import { getBot } from "../../src/instance";
import { setState } from "../../src/services/state.service";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const OK = 200;
const BAD = 400;
const UNAUTH = 401;
const FORBIDDEN = 403;
const METHOD_NOT_ALLOWED = 405;

const CORS_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-telegram-init-data",
  "Cache-Control": "no-store",
};

function json(body: unknown, status: number): any {
  const safe = JSON.parse(
    JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
  );
  return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify(safe) };
}

function ok(data: unknown) {
  return json({ ok: true, data }, 200);
}

function fail(error: string, status = OK) {
  return json({ ok: false, error }, status);
}

async function readBody(event: any): Promise<any> {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function toId(v: any): number | null {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toBool(v: any): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

function isAdminTg(telegramId: bigint): boolean {
  const ids = (process.env.ADMIN_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(telegramId.toString());
}

interface AppCtx {
  dbUser: any;
  isAdmin: boolean;
}

async function resolveCtx(event: any): Promise<AppCtx | null> {
  const headers: Record<string, string> = event.headers ?? {};
  const qp: Record<string, string> = event.queryStringParameters ?? {};
  let initData: string = headers["x-telegram-init-data"] ?? qp["initData"] ?? "";

  // /api/app/auth — тело {initData}; во всех остальных — заголовок/query.
  let verified = verifyWebAppInitData(initData);
  if (!verified && event.body) {
    try {
      const body = JSON.parse(event.body);
      if (body?.initData) verified = verifyWebAppInitData(body.initData);
    } catch {}
  }
  if (!verified) return null;

  const dbUser = await getUserByTelegramId(BigInt(verified.userId));
  if (dbUser) {
    return { dbUser, isAdmin: isAdminTg(BigInt(verified.userId)) };
  }
  const created = await getOrCreateUser(
    BigInt(verified.userId),
    verified.username,
    verified.firstName,
    verified.lastName
  );
  return { dbUser: created, isAdmin: isAdminTg(BigInt(verified.userId)) };
}

function adminOrForbidden(ctx: AppCtx): boolean {
  if (ctx.isAdmin) return true;
  return false;
}

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Ожидает оплаты",
  pending_verification: "Ожидает проверки чека",
  paid: "Оплачен",
  processing: "В обработке",
  shipped: "Отправлен",
  completed: "Завершён",
  cancelled: "Отменён",
};
const PAYMENT_LABELS: Record<string, string> = {
  pending: "Ожидает оплаты",
  pending_verification: "Ожидает проверки",
  paid: "Оплачен",
  rejected: "Отклонён",
};

function price(n: any): number {
  return Number(n ?? 0);
}

function productDto(p: any) {
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? "",
    price: price(p.price),
    imageUrl: p.imageUrl ?? "",
    stock: p.stock,
    isActive: p.isActive,
    categoryId: p.categoryId,
    categoryName: p.category?.name ?? "",
  };
}

function courseDto(c: any) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? "",
    price: price(c.price),
    imageUrl: c.imageUrl ?? "",
    isActive: c.isActive,
    itemsCount: Array.isArray(c.items) ? c.items.length : 0,
    items: Array.isArray(c.items)
      ? c.items.map((ci: any) => ({
          productId: ci.productId,
          quantity: ci.quantity,
          product: ci.product
            ? {
                id: ci.product.id,
                name: ci.product.name,
                price: price(ci.product.price),
                imageUrl: ci.product.imageUrl ?? "",
                stock: ci.product.stock,
              }
            : null,
        }))
      : [],
  };
}

async function cartDto(userId: number) {
  const items = await getCart(userId);
  const normalized = items.map((item: any) => {
    if (item.type === "course" && item.course) {
      const first = item.course.items?.[0]?.product;
      return {
        cartItemId: item.id,
        type: "course",
        id: item.course.id,
        name: item.course.name,
        price: price(item.course.price),
        quantity: item.quantity,
        subtotal: price(item.course.price) * item.quantity,
        imageUrl: item.course.imageUrl ?? first?.imageUrl ?? "",
        stockMax: null,
      };
    }
    if (item.product) {
      return {
        cartItemId: item.id,
        type: "product",
        id: item.product.id,
        name: item.product.name,
        price: price(item.product.price),
        quantity: item.quantity,
        subtotal: price(item.product.price) * item.quantity,
        imageUrl: item.product.imageUrl ?? "",
        stockMax: item.product.stock,
      };
    }
    return null;
  });
  const list = normalized.filter(
    (i): i is NonNullable<(typeof normalized)[number]> => i !== null
  );
  const total = list.reduce((s, i) => s + i.subtotal, 0);
  const count = list.reduce((s, i) => s + i.quantity, 0);
  return { items: list, total, count };
}

function orderDto(o: any) {
  const status = STATUS_LABELS[o.status] ?? o.status;
  const payment = PAYMENT_LABELS[o.paymentStatus] ?? o.paymentStatus;
  return {
    id: o.id,
    total: price(o.total),
    status: o.status,
    statusLabel: status,
    paymentStatus: o.paymentStatus,
    paymentLabel: payment,
    fullName: o.fullName ?? "",
    region: o.region ?? "",
    city: o.city ?? "",
    postalCode: o.postalCode ?? "",
    address: o.address ?? "",
    phone: o.phone ?? "",
    trackNumber: o.trackNumber ?? "",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    paidAt: o.paidAt,
    items: (o.items ?? []).map((i: any) => ({
      id: i.id,
      productName: i.productName,
      quantity: i.quantity,
      price: price(i.price),
      subtotal: price(i.subtotal),
      productId: i.productId ?? null,
      courseId: i.courseId ?? null,
    })),
  };
}

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer; ext: string } | null {
  const m = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heic",
    "application/pdf": "pdf",
  };
  const ext = extMap[mime];
  if (!ext) return null;
  try {
    const buffer = Buffer.from(m[2], "base64");
    if (buffer.length === 0 || buffer.length > 8 * 1024 * 1024) return null;
    return { mime, buffer, ext };
  } catch {
    return null;
  }
}

async function notifyClient(
  telegramId: bigint,
  text: string,
  keyboard?: any
): Promise<void> {
  try {
    if (!process.env.BOT_TOKEN) return;
    await getBot().api.sendMessage(telegramId.toString(), text, {
      parse_mode: "HTML",
      ...(keyboard ? { reply_markup: keyboard } : {}),
    });
  } catch {}
}

/* ------------------------------------------------------------------ */
/* Handler                                                             */
/* ------------------------------------------------------------------ */

export const handler: Handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  const path = ((event.path ?? "/").split("?")[0]).replace(/\/+$/, "");
  const prefix = "/api/app";
  const rest = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  const parts = rest.split("/").filter(Boolean);
  const method = (event.httpMethod ?? "GET").toUpperCase();

  // Передаём все в один роутер; 404/405 — на общем обработчике.
  try {
    return await route(event, parts, method);
  } catch (e: any) {
    console.error("app function error", e);
    return json(
      { ok: false, error: "INTERNAL", message: String(e?.message ?? e).slice(0, 300) },
      500
    );
  }
};

async function route(event: any, parts: string[], method: string): Promise<any> {
  const seg = parts[0] ?? "";
  const sub = parts[1];
  const id = toId(sub);

  // --- публичный /auth: без контекста ---
  if (seg === "auth") {
    const made = await resolveCtx(event);
    if (!made) return fail("AUTH_FAILED", UNAUTH);
    return ok(await meDto(made));
  }

  // --- все остальные: нужен авторизованный контекст ---
  const ctx = await resolveCtx(event);
  if (!ctx) return fail("AUTH_FAILED", UNAUTH);
  const { dbUser, isAdmin } = ctx;

  // ---- Каталог / поиск ----
  if (seg === "catalog" && method === "GET") {
    const [categories, featured] = await Promise.all([
      getActiveCategories(),
      prisma.product.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
        take: 24,
        include: { category: true },
      }),
    ]);
    return ok({
      categories: categories.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description ?? "",
        imageUrl: c.imageUrl ?? "",
        count: c._count?.products ?? 0,
      })),
      products: featured.map(productDto),
      cart: await cartDto(dbUser.id),
    });
  }

  if (seg === "products") {
    if (!id && method === "GET") {
      const qp = event.queryStringParameters ?? {};
      const categoryId = toInt(qp.categoryId);
      const q = String(qp.q ?? "").trim().slice(0, 100);
      const page = toInt(qp.page) ?? 0;
      const pageSize = Math.min(toInt(qp.pageSize) ?? 20, 50);
      const where: any = { isActive: true };
      if (categoryId) where.categoryId = categoryId;
      if (q) where.name = { contains: q, mode: "insensitive" };
      const [products, total] = await Promise.all([
        prisma.product.findMany({
          where,
          orderBy: { createdAt: "asc" },
          skip: page * pageSize,
          take: pageSize,
          include: { category: true },
        }),
        prisma.product.count({ where }),
      ]);
      return ok({
        products: products.map(productDto),
        total,
        page,
        cart: await cartDto(dbUser.id),
      });
    }
    // GET /products/:id
    if (id && method === "GET") {
      const p = await getProductById(id);
      if (!p) return fail("PRODUCT_NOT_FOUND");
      return ok({ product: productDto(p), cart: await cartDto(dbUser.id) });
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  if (seg === "courses") {
    if (!id && method === "GET") {
      const courses = await getActiveCourses();
      return ok({ courses: courses.map(courseDto) });
    }
    if (id && method === "GET") {
      const c = await getCourseById(id);
      if (!c) return fail("COURSE_NOT_FOUND");
      return ok({ course: courseDto(c), cart: await cartDto(dbUser.id) });
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Корзина ----
  if (seg === "cart") {
    const body = await readBody(event);
    if (method === "GET") {
      return ok(await cartDto(dbUser.id));
    }
    if (seg === "cart" && method === "POST" && sub === "add") {
      const type = String(body.type ?? "");
      const targetId = toId(body.id);
      const quantity = Math.min(Math.max(toInt(body.quantity) ?? 1, 1), 100);
      if (!targetId || !["product", "course"].includes(type)) {
        return fail("INVALID_REQUEST", BAD);
      }
      try {
        if (type === "product") await addProductToCart(dbUser.id, targetId, quantity);
        else await addCourseToCart(dbUser.id, targetId, quantity);
      } catch (e: any) {
        return fail(userFriendlyError(e.message ?? "GENERIC", dbUser.lang));
      }
      return ok(await cartDto(dbUser.id));
    }
    if (method === "POST" && sub === "update") {
      const itemId = toId(body.itemId);
      const delta = Math.sign(toInt(body.delta) ?? 1);
      if (!itemId) return fail("INVALID_REQUEST", BAD);
      try {
        if (delta > 0) await increaseCartItem(itemId, dbUser.id);
        else await decreaseCartItem(itemId, dbUser.id);
      } catch (e: any) {
        return fail(userFriendlyError(e.message ?? "GENERIC", dbUser.lang));
      }
      return ok(await cartDto(dbUser.id));
    }
    if (method === "POST" && sub === "remove") {
      const itemId = toId(body.itemId);
      if (!itemId) return fail("INVALID_REQUEST", BAD);
      await deleteCartItem(itemId, dbUser.id);
      return ok(await cartDto(dbUser.id));
    }
    if (method === "POST" && sub === "clear") {
      await clearCart(dbUser.id);
      return ok(await cartDto(dbUser.id));
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Оформление и оплата ----
  if (seg === "checkout") {
    const body = await readBody(event);
    if (method === "POST" && sub === "create") {
      const validation = await validateCartForOrder(dbUser.id);
      if (!validation.ok) return fail(userFriendlyError(validation.error ?? "GENERIC", dbUser.lang));
      const phone = process.env.PAYMENT_PHONE ?? "";
      const details = process.env.PAYMENT_DETAILS ?? "";
      if (!phone && !details) return fail("PAYMENT_NOT_CONFIGURED");
      const order = await createOrder(dbUser.id);
      const profile = ((dbUser as any).profile ?? {}) as Record<string, any>;
      return ok({
        orderId: order.id,
        total: price(order.total),
        paymentPhone: phone,
        paymentDetails: details,
        profile: {
          fullName: profile.fullName ?? "",
          region: profile.region ?? "",
          city: profile.city ?? "",
          postalCode: profile.postalCode ?? "",
          address: profile.address ?? "",
          phone: profile.phone ?? "",
        },
      });
    }
    if (method === "POST" && sub === "submit") {
      const orderId = toId(body.orderId);
      if (!orderId) return fail("INVALID_REQUEST", BAD);
      const order = await getOrderById(orderId);
      if (!order || order.userId !== dbUser.id) return fail("ORDER_NOT_FOUND");
      if (order.status === OrderStatus.cancelled) return fail("ORDER_CANCELLED");

      const fields = {
        fullName: String(body.fullName ?? "").trim(),
        region: String(body.region ?? "").trim(),
        city: String(body.city ?? "").trim(),
        postalCode: String(body.postalCode ?? "").trim(),
        address: String(body.address ?? "").trim(),
        phone: String(body.phone ?? "").trim(),
      };
      if (!validateName(fields.fullName, "ФИО", dbUser.lang).ok) return fail("INVALID_FULLNAME", BAD);
      if (!validateName(fields.region, "Регион", dbUser.lang).ok) return fail("INVALID_REGION", BAD);
      if (!validateName(fields.city, "Город", dbUser.lang).ok) return fail("INVALID_CITY", BAD);
      if (!validateAddress(fields.address, dbUser.lang).ok) return fail("INVALID_ADDRESS", BAD);
      if (!validatePhone(fields.phone, dbUser.lang).ok) return fail("INVALID_PHONE", BAD);
      if (fields.postalCode) {
        if (!validatePostal(fields.postalCode, dbUser.lang).ok) return fail("INVALID_POSTAL", BAD);
      }

      const updated = await updateOrder(order.id, fields);

      // Сохраняем профиль доставки для будущих заказов.
      await prisma.user
        .update({
          where: { id: dbUser.id },
          data: {
            profile: { ...(((dbUser as any).profile ?? {}) as object), ...fields } as Prisma.InputJsonValue,
          },
        })
        .catch(() => {});

      const hasReceipt = Boolean(order.receiptFileId || order.receiptUrl || updated.receiptUrl);
      if (hasReceipt) {
        await completeReceiptSubmission(order.id);
        const fresh = await getOrderById(order.id);
        try {
          await notifyAdminsNewOrder(getBot(), fresh);
        } catch {}
        return ok({ submitted: true, order: orderDto(fresh) });
      }
      return ok({ submitted: false, needReceipt: true, order: orderDto(updated) });
    }
    if (method === "POST" && sub === "receipt") {
      const orderId = toId(body.orderId);
      if (!orderId) return fail("INVALID_REQUEST", BAD);
      const order = await getOrderById(orderId);
      if (!order || order.userId !== dbUser.id) return fail("ORDER_NOT_FOUND");
      if (order.status === OrderStatus.cancelled) return fail("ORDER_CANCELLED");
      const dataUrl = String(body.dataUrl ?? "");
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) return fail("INVALID_RECEIPT_FILE", BAD);

      const fileName = `receipt_${orderId}.${parsed.ext}`;
      let url: string;
      try {
        ({ url } = await uploadFile("receipts", fileName, parsed.buffer, parsed.mime));
      } catch (e: any) {
        if (e?.message === "STORAGE_NOT_CONFIGURED") return fail("STORAGE_NOT_CONFIGURED");
        return fail("UPLOAD_FAILED");
      }

      await updateOrder(order.id, {
        receiptUrl: url,
        receiptFileName: fileName,
        receiptMimeType: parsed.mime,
      });
      await createPaymentRecord(order.id, dbUser.id, price(order.total), url, fileName, undefined, parsed.mime);

      // Данные уже заполнены — финализируем заказ и уведомляем админов.
      if (order.fullName && order.phone) {
        await completeReceiptSubmission(order.id);
        const fresh = await getOrderById(order.id);
        try {
          await notifyAdminsNewOrder(getBot(), fresh);
        } catch {}
        return ok({ uploaded: true, submitted: true, order: orderDto(fresh) });
      }
      const fresh = await getOrderById(order.id);
      return ok({ uploaded: true, submitted: false, needData: true, order: orderDto(fresh) });
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Заказы пользователя ----
  if (seg === "orders") {
    if (!id && method === "GET") {
      const orders = await getUserOrders(dbUser.id, 0, 50);
      return ok({ orders: orders.map(orderDto) });
    }
    if (id && method === "GET") {
      const order = await getOrderById(id);
      if (!order || (order.userId !== dbUser.id && !isAdmin)) return fail("ORDER_NOT_FOUND");
      let tracking = null;
      if (order.trackNumber) {
        tracking = await getTrackingInfo(String(order.trackNumber));
      }
      return ok({ order: orderDto(order), tracking, trackingLink: order.trackNumber ? trackingLink(String(order.trackNumber)) : "" });
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Трекер ----
  if (seg === "tracking" && method === "GET") {
    const number = String((event.queryStringParameters ?? {}).number ?? "").trim();
    if (!number) return fail("INVALID_REQUEST", BAD);
    const info = await getTrackingInfo(number);
    return ok({ tracking: info, enabled: trackingEnabled() });
  }

  // ---- ИИ-консультант ----
  if (seg === "ai" && method === "POST") {
    const body = await readBody(event);
    const message = String(body.message ?? "").trim().slice(0, 800);
    if (!message) return fail("EMPTY_MESSAGE", BAD);
    if (!aiEnabled()) return fail("AI_NOT_CONFIGURED");
    const shimCtx = {
      state: { user: { telegramId: dbUser.telegramId, isAdmin } },
    } as any;
    const reply = (await handleAiChat(shimCtx, message)) ?? "Извините, ответ пока не получен. Попробуйте ещё раз.";
    return ok({ reply });
  }

  // ---- Профиль / настройки ----
  if (seg === "me" && method === "GET") {
    return ok(await meDto(ctx));
  }

  if (seg === "settings") {
    const body = await readBody(event);
    const data: any = {};
    if (body.lang !== undefined) {
      if (body.lang !== "ru" && body.lang !== "kk") return fail("INVALID_LANG", BAD);
      data.lang = body.lang;
    }
    if (body.aiMode !== undefined) {
      data.aiMode = toBool(body.aiMode);
      await setAiMode(dbUser.id, data.aiMode);
      delete data.aiMode;
    }
    if (body.profile && typeof body.profile === "object") {
      const profile = { ...(((dbUser as any).profile ?? {}) as object), ...body.profile };
      data.profile = profile as Prisma.InputJsonValue;
    }
    if (Object.keys(data).length > 0) {
      await prisma.user.update({ where: { id: dbUser.id }, data });
    }
    return ok(await meDto(ctx));
  }

  // ---- АДМИНКА ----
  if (seg === "admin") {
    if (!adminOrForbidden(ctx)) return fail("FORBIDDEN", FORBIDDEN);
    return adminRoutes(event, parts.slice(1), method, dbUser);
  }

  return fail("NOT_FOUND", 404);
}

/* ------------------------------------------------------------------ */
/* Auxiliary                                                           */
/* ------------------------------------------------------------------ */

async function meDto(ctx: AppCtx): Promise<any> {
  const { dbUser } = ctx;
  const profile = ((dbUser as any).profile ?? {}) as Record<string, any>;
  return {
    user: {
      id: dbUser.id,
      telegramId: dbUser.telegramId.toString(),
      username: dbUser.username ?? "",
      firstName: dbUser.firstName ?? "",
      lastName: dbUser.lastName ?? "",
      lang: dbUser.lang ?? "ru",
      aiMode: dbUser.aiMode ?? true,
      role: dbUser.role,
    },
    isAdmin: ctx.isAdmin,
    profile: {
      fullName: profile.fullName ?? "",
      region: profile.region ?? "",
      city: profile.city ?? "",
      postalCode: profile.postalCode ?? "",
      address: profile.address ?? "",
      phone: profile.phone ?? "",
    },
    settings: {
      storeName: "MASSA TARAZ",
      support: "@massataraz08",
      paymentPhone: process.env.PAYMENT_PHONE ?? "",
      paymentDetails: process.env.PAYMENT_DETAILS ?? "",
      aiEnabled: aiEnabled(),
    },
  };
}

async function adminRoutes(event: any, parts: string[], method: string, dbUser: any): Promise<any> {
  const seg = parts[0] ?? "";
  const sub = parts[1];
  const id = toId(sub);
  const body = await readBody(event);

  async function notifyStatus(telegramId: bigint, orderId: number, status: string, trackNumber?: string) {
    const labels: Record<string, string> = {
      pending_payment: "ожидает оплаты",
      pending_verification: "ожидает проверки",
      paid: "оплачен",
      processing: "в обработке",
      shipped: "отправлен",
      completed: "завершён",
      cancelled: "отменён",
    };
    const track = status === "shipped" && trackNumber
      ? `\n\n📦 Трек-номер: <code>${trackNumber}</code>\n🌐 ${trackingLink(trackNumber)}`
      : "";
    await notifyClient(telegramId, `📦 Статус вашего заказа №${orderId}: <b>${labels[status] ?? status}</b>${track}`);
  }

  // ---- Товары ----
  if (seg === "products") {
    if (method === "GET" && !id) {
      const products = await getAllProducts(false);
      return ok({ products: products.map(productDto) });
    }
    if (method === "POST" && !id) {
      const name = String(body.name ?? "").trim();
      const priceRaw = Number(String(body.price ?? "").replace(",", "."));
      const categoryId = toId(body.categoryId);
      const stock = toInt(body.stock) ?? 0;
      if (!validateName(name, "Название").ok) return fail("INVALID_NAME", BAD);
      if (!(priceRaw > 0)) return fail("INVALID_PRICE", BAD);
      const cat = await getCategoryById(categoryId ?? 0);
      if (!cat) return fail("CATEGORY_NOT_FOUND", BAD);
      const p = await createProduct({
        name,
        price: Math.round(priceRaw * 100) / 100,
        description: String(body.description ?? "").slice(0, 2000) || undefined,
        categoryId: categoryId!,
        stock,
        imageUrl: String(body.imageUrl ?? "") || undefined,
      });
      return ok({ product: productDto({ ...p, category: cat }) });
    }
    if (seg === "products" && id) {
      const existing = await getProductById(id);
      if (!existing) return fail("PRODUCT_NOT_FOUND");
      if (method === "PATCH") {
        const data: any = {};
        if (body.name !== undefined) {
          const name = String(body.name).trim();
          if (!validateName(name, "Название").ok) return fail("INVALID_NAME", BAD);
          data.name = name;
        }
        if (body.price !== undefined) {
          const priceRaw = Number(String(body.price).replace(",", "."));
          if (!(priceRaw > 0)) return fail("INVALID_PRICE", BAD);
          data.price = Math.round(priceRaw * 100) / 100;
        }
        if (body.description !== undefined) data.description = String(body.description ?? "");
        if (body.categoryId !== undefined) {
          const categoryId = toId(body.categoryId);
          if (!categoryId) return fail("CATEGORY_NOT_FOUND", BAD);
          data.categoryId = categoryId;
        }
        if (body.stock !== undefined) {
          const stock = toInt(body.stock);
          if (stock === null) return fail("INVALID_STOCK", BAD);
          data.stock = stock;
        }
        if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl ?? "");
        if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
        const p = await updateProduct(id, data);
        return ok({ product: productDto(p) });
      }
      if (method === "POST" && parts[2] === "toggle") {
        const p = await toggleProductActive(id, !existing.isActive);
        return ok({ product: productDto(p) });
      }
      if (method === "DELETE") {
        const res = await deleteProduct(id);
        if (!res.ok) return fail(res.error ?? "UPDATE_FAILED");
        return ok({ deleted: true });
      }
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Категории ----
  if (seg === "categories") {
    if (method === "GET" && !id) {
      const cats = await getAllCategories();
      return ok({
        categories: cats.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? "",
          imageUrl: c.imageUrl ?? "",
          isActive: c.isActive,
          count: c._count?.products ?? 0,
        })),
      });
    }
    if (method === "POST" && !id) {
      const name = String(body.name ?? "").trim();
      if (!validateName(name, "Название").ok) return fail("INVALID_NAME", BAD);
      const c = await createCategory({
        name,
        description: String(body.description ?? "").slice(0, 500) || undefined,
        imageUrl: String(body.imageUrl ?? "") || undefined,
      });
      return ok({ category: c });
    }
    if (id) {
      const existing = await getCategoryById(id);
      if (!existing) return fail("CATEGORY_NOT_FOUND");
      if (method === "PATCH") {
        const data: any = {};
        if (body.name !== undefined) {
          const name = String(body.name).trim();
          if (!validateName(name, "Название").ok) return fail("INVALID_NAME", BAD);
          data.name = name;
        }
        if (body.description !== undefined) data.description = String(body.description ?? "");
        if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl ?? "");
        if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
        const c = await updateCategory(id, data);
        return ok({ category: c });
      }
      if (method === "POST" && parts[2] === "toggle") {
        const c = await toggleCategoryActive(id, !existing.isActive);
        return ok({ category: c });
      }
      if (method === "DELETE") {
        const res = await deleteCategoryHard(id);
        if (!res.ok) return fail(res.error ?? "UPDATE_FAILED");
        return ok({ deleted: true });
      }
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Курсы / связки ----
  if (seg === "courses") {
    if (method === "GET" && !id) {
      const courses = await getAllCourses();
      return ok({ courses: courses.map(courseDto) });
    }
    if (method === "POST" && !id) {
      const name = String(body.name ?? "").trim();
      const priceRaw = Number(String(body.price ?? "").replace(",", "."));
      if (!validateName(name, "Название").ok) return fail("INVALID_NAME", BAD);
      if (!(priceRaw > 0)) return fail("INVALID_PRICE", BAD);
      const c = await createCourse({
        name,
        price: Math.round(priceRaw * 100) / 100,
        description: String(body.description ?? "").slice(0, 2000) || undefined,
        imageUrl: String(body.imageUrl ?? "") || undefined,
      });
      return ok({ course: courseDto(c) });
    }
    if (id) {
      const existing = await getCourseById(id);
      if (!existing) return fail("COURSE_NOT_FOUND");
      if (method === "PATCH") {
        const data: any = {};
        if (body.name !== undefined) {
          const name = String(body.name).trim();
          if (!validateName(name, "Название").ok) return fail("INVALID_NAME", BAD);
          data.name = name;
        }
        if (body.price !== undefined) {
          const priceRaw = Number(String(body.price).replace(",", "."));
          if (!(priceRaw > 0)) return fail("INVALID_PRICE", BAD);
          data.price = Math.round(priceRaw * 100) / 100;
        }
        if (body.description !== undefined) data.description = String(body.description ?? "");
        if (body.imageUrl !== undefined) data.imageUrl = String(body.imageUrl ?? "");
        if (body.isActive !== undefined) data.isActive = toBool(body.isActive);
        const c = await updateCourse(id, data);
        return ok({ course: courseDto(c) });
      }
      if (method === "POST" && sub === "toggle") {
        const c = await toggleCourseActive(id, !existing.isActive);
        return ok({ course: courseDto(c) });
      }
      if (method === "POST" && parts[2] === "items" && parts[3] === "remove") {
        const productId = toId(body.productId);
        if (!productId) return fail("INVALID_REQUEST", BAD);
        await removeCourseItem(id, productId);
        const c = await getCourseById(id);
        return ok({ course: courseDto(c) });
      }
      if (method === "POST" && parts[2] === "items") {
        const productId = toId(body.productId);
        const quantity = Math.min(Math.max(toInt(body.quantity) ?? 1, 1), 100);
        if (!productId) return fail("INVALID_REQUEST", BAD);
        const product = await getProductById(productId);
        if (!product) return fail("PRODUCT_NOT_FOUND");
        await addCourseItem(id, productId, quantity);
        const c = await getCourseById(id);
        return ok({ course: courseDto(c) });
      }
      if (method === "DELETE") {
        const res = await deleteCourse(id);
        if (!res.ok) return fail(res.error ?? "UPDATE_FAILED");
        return ok({ deleted: true });
      }
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Заказы (админ) ----
  if (seg === "orders") {
    if (method === "GET" && !id) {
      const statusArg = (event.queryStringParameters ?? {}).status;
      const orders = await getAllOrders(statusArg as any, 0, 100);
      return ok({ orders: orders.map(orderDto) });
    }
    if (id && method === "GET") {
      const order = await getOrderById(id);
      if (!order) return fail("ORDER_NOT_FOUND");
      let tracking = null;
      if (order.trackNumber) tracking = await getTrackingInfo(String(order.trackNumber));
      return ok({ order: orderDto(order), tracking, client: { firstName: order.user?.firstName ?? "", username: order.user?.username ?? "" } });
    }
    if (id && method === "POST" && sub === "status") {
      const status = String(body.status ?? "");
      if (!Object.values(OrderStatus).includes(status as OrderStatus)) return fail("INVALID_STATUS", BAD);
      const order = await getOrderById(id);
      if (!order) return fail("ORDER_NOT_FOUND");
      await changeOrderStatus(id, status as OrderStatus);
      let trackNumber: string | undefined;
      if (body.trackNumber !== undefined) {
        trackNumber = String(body.trackNumber ?? "").trim();
        await setOrderTrackNumber(id, trackNumber);
      }
      const updated = await getOrderById(id);
      if (trackNumber && updated?.trackNumber) {
        registerForTracking(String(updated.trackNumber), order.user?.lang ?? "ru").catch(() => {});
      }
      await notifyStatus(order.user.telegramId, id, status, updated?.trackNumber ?? undefined);
      return ok({ order: orderDto(updated), tracking: updated?.trackNumber ? await getTrackingInfo(String(updated.trackNumber)) : null });
    }
    if (id && method === "POST" && sub === "payment") {
      const action = String(body.action ?? "");
      const order = await getOrderById(id);
      if (!order) return fail("ORDER_NOT_FOUND");
      if (action === "confirm") {
        const res = await confirmOrderPayment(id);
        if (!res.ok || !res.order) return fail(userFriendlyError(res.error ?? "GENERIC", order.user?.lang));
        await notifyClient(
          order.user.telegramId,
          `✅ <b>Оплата подтверждена!</b>\n\nЗаказ №${id} принят в обработку.`
        );
        try {
          await notifyAdminOrderPaid(getBot(), res.order);
        } catch {}
        return ok({ order: orderDto(res.order) });
      }
      if (action === "reject") {
        const reason = String(body.reason ?? "").trim().slice(0, 300);
        if (!reason) return fail("INVALID_REASON", BAD);
        const res = await rejectOrderPayment(id, reason);
        if (!res.ok || !res.order) return fail(userFriendlyError(res.error ?? "GENERIC", order.user?.lang));
        await notifyClient(
          order.user.telegramId,
          `❌ <b>Оплата не подтверждена.</b>\n\nЗаказ №${id}\nПричина: ${reason}\n\nПожалуйста, отправьте новый чек.`,
          { inline_keyboard: [[{ text: "📎 Отправить новый чек", callback_data: `order:view:${id}` }]] }
        );
        await setState(order.user.id, ConversationState.WAITING_RECEIPT, { orderId: id });
        try {
          await notifyAdminOrderRejected(getBot(), res.order, reason);
        } catch {}
        return ok({ order: orderDto(res.order) });
      }
      return fail("INVALID_REQUEST", BAD);
    }
    return fail("METHOD_NOT_ALLOWED", METHOD_NOT_ALLOWED);
  }

  // ---- Статистика ----
  if (seg === "statistics" && method === "GET") {
    const [stats, counts] = await Promise.all([getStatistics(), getOrderCountsByStatus()]);
    return ok({ statistics: stats, counts });
  }

  // ---- Загрузка картинок (товары/категории/курсы) ----
  if (seg === "upload" && method === "POST") {
    const prefix = ["products", "categories", "courses"].includes(String(body.prefix ?? ""))
      ? String(body.prefix)
      : "images";
    const parsed = parseDataUrl(String(body.dataUrl ?? ""));
    if (!parsed) return fail("INVALID_FILE", BAD);
    const fileName = `image_${Date.now()}.${parsed.ext}`;
    try {
      const { url } = await uploadFile(prefix, fileName, parsed.buffer, parsed.mime);
      return ok({ imageUrl: url });
    } catch (e: any) {
      if (e?.message === "STORAGE_NOT_CONFIGURED") return fail("STORAGE_NOT_CONFIGURED");
      return fail("UPLOAD_FAILED");
    }
  }

  return fail("NOT_FOUND", 404);
}