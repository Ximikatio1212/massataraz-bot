import { BotContext } from "../bot/middleware/auth";
import { getUserByTelegramId } from "./user.service";
import { prisma } from "../db/prisma";
import { mark } from "../utils/diag";

// ───── провайдер ─────

interface Provider {
  baseUrl: string;
  chatPath: string;
  apiKey: string;
  model: string;
}

const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string; chatPath?: string }> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-3.5-flash",
    chatPath: "/chat/completions",
  },
  mistral: {
    baseUrl: "https://api.mistral.ai",
    defaultModel: "mistral-small-latest",
  },
  groq: {
    baseUrl: "https://api.groq.com/openai",
    defaultModel: "openai/gpt-oss-120b",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api",
    defaultModel: "mistralai/mistral-small-3.1-24b-instruct:free",
  },
};

function providerConfig(): Provider | null {
  const name = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
  const p = PROVIDERS[name] ?? PROVIDERS.gemini;
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.AI_MODEL || p.defaultModel;
  return { baseUrl: p.baseUrl, chatPath: p.chatPath ?? "/v1/chat/completions", apiKey, model };
}

export function aiEnabled(): boolean {
  return providerConfig() != null;
}

// ───── AI-режим ─────

export async function getAiMode(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { aiMode: true } });
  return user?.aiMode ?? false;
}

export async function setAiMode(userId: number, on: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { aiMode: on } }).catch(() => {});
}

// ───── инструменты ─────

interface ToolDef {
  type: "function";
  function: { name: string; description: string; parameters: any };
}

function td(name: string, desc: string, params: any): ToolDef {
  return { type: "function", function: { name, description: desc, parameters: params } };
}

const clientTools: ToolDef[] = [
  td("search_products", "Поиск товаров по названию (возвращает id, name, price, stock, description, categoryId)", {
    type: "object",
    properties: { query: { type: "string" } },
    required: ["query"],
  }),
  td("list_categories", "Список активных категорий (id + name)", {
    type: "object", properties: {}, required: [],
  }),
  td("list_products", "Все активные товары (id, name, price, stock, categoryId)", {
    type: "object", properties: {}, required: [],
  }),
  td("get_courses", "Все курсы/связки (id, name, price, description)", {
    type: "object", properties: {}, required: [],
  }),
  td("get_order_status", "Статус заказа клиента (только свои заказы)", {
    type: "object", properties: { orderId: { type: "integer" } }, required: ["orderId"],
  }),
  td("explain_substance", "Краткая справка по веществу/компоненту (2–3 предложения из Wikipedia RU). Для вопросов вида «что такое тестостерон/креатин»", {
    type: "object", properties: { query: { type: "string" } }, required: ["query"],
  }),
];

const adminTools: ToolDef[] = [
  ...clientTools,
  td("create_category", "Создать новую категорию товаров", {
    type: "object",
    properties: { name: { type: "string" }, description: { type: "string" } },
    required: ["name"],
  }),
  td("create_product", "Создать новый товар. categoryId obtained via list_categories", {
    type: "object",
    properties: {
      name: { type: "string" },
      price: { type: "number", description: "цена в тенге" },
      description: { type: "string" },
      categoryId: { type: "integer" },
      stock: { type: "integer", description: "остаток на складе" },
    },
    required: ["name", "price", "categoryId"],
  }),
  td("create_course", "Создать курс/связку", {
    type: "object",
    properties: {
      name: { type: "string" },
      price: { type: "number" },
      description: { type: "string" },
    },
    required: ["name", "price"],
  }),
  td("add_course_item", "Добавить товар (productId) в курс. Товары ищите через list_products", {
    type: "object",
    properties: {
      courseId: { type: "integer" },
      productId: { type: "integer" },
      quantity: { type: "integer" },
    },
    required: ["courseId", "productId", "quantity"],
  }),
  td("set_product_stock", "Установить остаток товара", {
    type: "object",
    properties: { productId: { type: "integer" }, stock: { type: "integer" } },
    required: ["productId", "stock"],
  }),
];

// ───── исполнение инструментов ─────

async function execTool(name: string, args: any, ctx: BotContext): Promise<string> {
  try {
    switch (name) {
      case "search_products": {
        const q = String(args.query ?? "");
        const items = await prisma.product.findMany({
          where: { isActive: true, name: { contains: q, mode: "insensitive" } },
          select: { id: true, name: true, price: true, stock: true, description: true, categoryId: true },
          take: 15,
        });
        return JSON.stringify(items);
      }
      case "list_categories": {
        const cats = await prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
        return JSON.stringify(cats);
      }
      case "list_products": {
        const items = await prisma.product.findMany({
          where: { isActive: true },
          select: { id: true, name: true, price: true, stock: true, categoryId: true },
          orderBy: { name: "asc" }, take: 60,
        });
        return JSON.stringify(items);
      }
      case "get_courses": {
        const c = await prisma.course.findMany({
          where: { isActive: true },
          select: { id: true, name: true, price: true, description: true },
          orderBy: { name: "asc" },
        });
        return JSON.stringify(c);
      }
      case "get_order_status": {
        if (!ctx.state.user) return JSON.stringify({ error: "не авторизован" });
        const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
        if (!dbUser) return JSON.stringify({ error: "пользователь не найден" });
        const order = await prisma.order.findFirst({
          where: { id: Number(args.orderId), userId: dbUser.id },
        });
        if (!order) return JSON.stringify({ error: "заказ не найден" });
        return JSON.stringify({ id: order.id, status: order.status, total: String(order.total) });
      }
      case "explain_substance": {
        const query = encodeURIComponent(String(args.query ?? ""));
        const res: any = await fetch(
          `https://ru.wikipedia.org/api/rest_v1/page/summary/${query}`,
          { signal: AbortSignal.timeout(5000) }
        ).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!res?.extract) return "Справка из Wikipedia недоступна — ответь кратко из общих знаний.";
        return res.extract.slice(0, 500);
      }
      case "create_category": {
        if (!ctx.state.user?.isAdmin) return "Только для администратора";
        const cat = await prisma.category.create({
          data: { name: args.name, description: args.description ?? null },
        });
        return JSON.stringify({ ok: true, id: cat.id, name: cat.name });
      }
      case "create_product": {
        if (!ctx.state.user?.isAdmin) return "Только для администратора";
        const p = await prisma.product.create({
          data: {
            name: args.name,
            price: Number(args.price),
            description: args.description ?? null,
            categoryId: Number(args.categoryId),
            stock: Number(args.stock ?? 0),
          },
        });
        // После создания переводим админа в состояние приёма фото товара.
        try {
          const { setState } = await import("../services/state.service");
          const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
          if (dbUser) {
            const { ConversationState } = await import("@prisma/client");
            await setState(dbUser.id, ConversationState.WAITING_PRODUCT_IMAGE, { editProductId: p.id });
          }
        } catch {}
        return JSON.stringify({ ok: true, id: p.id, name: p.name, askPhoto: true });
      }
      case "create_course": {
        if (!ctx.state.user?.isAdmin) return "Только для администратора";
        const c = await prisma.course.create({
          data: { name: args.name, price: Number(args.price), description: args.description ?? null },
        });
        return JSON.stringify({ ok: true, id: c.id, name: c.name });
      }
      case "add_course_item": {
        if (!ctx.state.user?.isAdmin) return "Только для администратора";
        await prisma.courseItem.create({
          data: {
            courseId: Number(args.courseId),
            productId: Number(args.productId),
            quantity: Number(args.quantity ?? 1),
          },
        });
        return JSON.stringify({ ok: true });
      }
      case "set_product_stock": {
        if (!ctx.state.user?.isAdmin) return "Только для администратора";
        await prisma.product.update({
          where: { id: Number(args.productId) },
          data: { stock: Number(args.stock) },
        });
        return JSON.stringify({ ok: true });
      }
      default:
        return `Неизвестный инструмент: ${name}`;
    }
  } catch (e: any) {
    return `Ошибка: ${e.message ?? String(e)}`;
  }
}

// ───── система ─────

const CLIENT_SYSTEM = [
  "Ты — консультант магазина спортивного питания «Massa Taraz» (Казахстан, тенге).",
  "Отвечай на ПОСЛЕДНИЙ вопрос клиента, кратко и дружелюбно: 3–5 предложений, без списков из JSON и без служебных деталей. Рекомендуй товары по реальным данным из инструментов — цены и наличие не выдумывай.",
  "Старые непрочитанные/невыполненные просьбы из истории (до последнего сообщения) — игнорируй: отвечай только на последнее сообщение.",
  "Если по запросу нет совпадений в каталоге — НЕ пиши «не нашёл информацию в базе данных», не упоминай базу данных и технические детали. Вежливо скажи, что такого товара сейчас нет в ассортименте, предложи написать менеджеру или спроси точнее.",
  "Для вопросов о составе/свойствах (тестостерон, протеин, BCAA и т.д.) используй explain_substance и при необходимости дополни из общих знаний: 2–3 предложения, без лишней информации.",
  "Не давай медицинских/лечебных рекомендаций: это спортпит, не лекарство.",
].join("\n");

const ADMIN_SYSTEM = [
  "Ты — ИИ-помощник администратора магазина «Massa Taraz».",
  "Помогаешь управлять каталогом: категории, товары, курсы/связки, остатки.",
  "Перед созданием ОБЯЗАТЕЛЬНО покажи план: название, цена, категория, описание, остаток. Затем спроси «Создаю? Да / нет».",
  "Создавай товар/категорию/курс ТОЛЬКО после явного подтверждения «да» от админа.",
  "Старые непрочитанные/невыполненные просьбы (до последнего сообщения) — игнорируй: работай только по последнему сообщению.",
  "После create_product всегда попроси администратора отправить <b>фото товара</b> или написать «без фото».",
  "Не упоминай «базу данных» и не говори «не нашёл информации» — просто оперируй фактами или вежливо уточни.",
  "Используй инструменты для работы с БД. Всё на русском, кратко и по делу.",
].join("\n");

// ───── история ─────

interface Msg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
}

function cleanToolCalls(tc: any[]): any[] {
  if (!Array.isArray(tc)) return [];
  return tc.map((c: any) => ({
    id: c?.id,
    type: c?.type ?? "function",
    function: c?.function ?? { name: "", arguments: "{}" },
  }));
}

export function trimAiMessages(msgs: any[]): Msg[] {
  if (!Array.isArray(msgs)) return [];
  return msgs
    .map((m: any) => ({
      role: m.role,
      content: typeof m.content === "string" ? (m.content.length > 600 ? m.content.slice(0, 570) + "…(обрезано)" : m.content) : m.content,
      ...(m.tool_calls?.length ? { tool_calls: cleanToolCalls(m.tool_calls) } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      ...(m.name ? { name: m.name } : {}),
    }))
    .slice(-20);
}

/**
 * Обрезает «хвост» истории, у которого нет завершающего ответа бота
 * (старые непрочитанные сообщения / незавершённые tool-раунды).
 * Они заставляли модель достраивать устаревшие просьбы вместо нового вопроса.
 */
export function clampHistoryToCleanEnd(msgs: any[]): Msg[] {
  const out = trimAiMessages(msgs);
  while (out.length > 0) {
    const last = out[out.length - 1];
    const clean =
      last.role === "assistant" && typeof last.content === "string" && last.content.trim().length > 0;
    if (clean) break;
    out.pop();
  }
  return out;
}

// ───── основной вызов ─────

export async function handleAiChat(
  ctx: BotContext,
  userText: string
): Promise<string | null> {
  const cfg = providerConfig();
  if (!cfg || !ctx.state.user) return null;
  mark("ai:cfg-ok");

  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return null;
  mark("ai:user-ok");

  const isAdmin = ctx.state.user.isAdmin;
  const systemLang = dbUser.lang === "kk" ? "kk" : "ru";
  const systemContent = isAdmin
    ? ADMIN_SYSTEM
    : systemLang === "kk"
      ? `${CLIENT_SYSTEM}\nОтвечай клиенту ТОЛЬКО на казахском языке. Названия товаров/категорий оставляй как в базе.`
      : CLIENT_SYSTEM;
  // Клиентам держим лишь свежий контекст (пара последних реплик), чтобы ответ
  // всегда относился к последнему вопросу, а не к старой теме из истории.
  const history = clampHistoryToCleanEnd(dbUser.aiConversation as any[]);
  const messages: Msg[] = [
    { role: "system", content: systemContent },
    ...(isAdmin ? history.slice(-10) : history.slice(-6)),
    { role: "user", content: userText },
  ];
  const tools = isAdmin ? adminTools : clientTools;

  // Индекс, с которого начинаются сообщения данного вызова: цикл сохранения
  // не должен подставлять более старые ответы бота при сбое модели.
  const startIdx = messages.length;

  let safety = 0;
  while (safety++ < 6) {
    let res: any;
    try {
      mark(`ai:req try=${safety}`);
      const raw = await fetch(`${cfg.baseUrl}${cfg.chatPath}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          tools,
          tool_choice: "auto",
          temperature: 0.3,
          max_tokens: 700,
        }),
        signal: AbortSignal.timeout(9_000),
      });
      mark(`ai:http ${raw.status}`);
      if (raw.status === 429) {
        mark("ai:429");
        await new Promise((r) => setTimeout(r, 2_000));
        continue;
      }
      if (raw.ok) {
        res = await raw.json().catch(() => null);
      }
    } catch (e: any) {
      mark(`ai:req-err ${String(e?.message ?? e).slice(0, 120)}`);
      break;
    }

    const choice = res?.choices?.[0];
    if (!choice) {
      mark("ai:no-choice");
      break;
    }

    const assistant = choice.message as Msg;
    messages.push(assistant);

    if (!assistant.tool_calls?.length) {
      mark("ai:answer");
      break;
    }
    mark(`ai:tools ${assistant.tool_calls.length}`);

    for (const call of assistant.tool_calls) {
      let args: any = {};
      try { args = JSON.parse(call.function?.arguments ?? "{}"); } catch {}
      const result = await execTool(call.function?.name ?? "", args, ctx);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  for (let i = messages.length - 1; i >= startIdx; i--) {
    const m = messages[i];
    if (m.role === "assistant" && m.content) {
      const toSave = messages.slice(1).slice(-20).map((m: any) => ({
        role: m.role,
        content: m.content,
        ...(m.tool_calls?.length ? { tool_calls: cleanToolCalls(m.tool_calls) } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
        ...(m.name ? { name: m.name } : {}),
      }));
      await prisma.user
        .update({ where: { id: dbUser.id }, data: { aiConversation: toSave } })
        .catch(() => {});
      mark("ai:content");
      return m.content as string;
    }
  }

  mark("ai:fallback");
  return "Сервис ИИ-ответов сейчас перегружен. Попробуйте ещё раз через пару минут.";
}
