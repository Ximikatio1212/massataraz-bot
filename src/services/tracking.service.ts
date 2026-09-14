// Интеграция с 17TRACK API (v2.4): регистрация трек-номера и получение
// статусов доставки. Админ вводит трек-номер в заказе — клиент автоматически
// видит трекер в Telegram Mini App.
//
// 17TRACK: base https://api.17track.net/track/v2.4, header "17token", тело — JSON.
// Carrier code СДЭК (CDEK): 100030 (см. apicarrier.all.json).
// Если TRACKING_API_KEY не задан — сервис деградирует до ссылки на
// официальный трекинг СДЭК, а события вернёт пустым списком.

const BASE_URL = "https://api.17track.net/track/v2.4";
const CDEK_CARRIER_CODE = 100030;

export function trackingEnabled(): boolean {
  return !!process.env.TRACKING_API_KEY;
}

/** Ссылка на официальный мониторинг СДЭК по трек-номеру. */
export function trackingLink(trackingNumber: string): string {
  return `https://www.cdek.ru/ru/tracking?order_id=${encodeURIComponent(String(trackingNumber).trim())}`;
}

export interface TrackingEvent {
  time: string;
  location: string;
  description: string;
}

export interface TrackingInfo {
  trackingNumber: string;
  carrier: string;
  link: string;
  statusCode: number | null;
  statusDescription: string | null;
  delivered: boolean;
  events: TrackingEvent[];
  registered: boolean;
}

async function call17track(path: string, body: unknown): Promise<any | null> {
  const key = process.env.TRACKING_API_KEY;
  if (!key) throw new Error("TRACKING_DISABLED");
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "17token": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9_000),
  });
  if (!res.ok) throw new Error(`HTTP_${res.status}`);
  return res.json().catch(() => null);
}

/** Регистрирует трек-номер в 17TRACK (fire-and-forget, ошибки не роняют заказ). */
export async function registerForTracking(
  trackingNumber: string,
  lang = "ru"
): Promise<{ ok: boolean; error?: string }> {
  const number = String(trackingNumber).trim();
  if (!number) return { ok: false, error: "EMPTY" };
  try {
    const data = await call17track("/register", [
      { number, carrier: CDEK_CARRIER_CODE, lang },
    ]);
    // code === 0 — успех. Повторная регистрация (уже добавлен) тоже считается ок.
    if (data && typeof data.code === "number" && data.code !== 0) {
      return { ok: false, error: `17TRACK_${data.code}` };
    }
    return { ok: true };
  } catch (e: any) {
    // ВАЖНО: вернуть ok даже при сетевом сбое — номер уже сохранён в заказе,
    // запрос повторится при следующем открытии трекера клиентом.
    return { ok: false, error: String(e?.message ?? e) };
  }
}

/** Возвращает статусы посылки из 17TRACK. При сбое — пустой трекер со ссылкой. */
export async function getTrackingInfo(
  trackingNumber: string
): Promise<TrackingInfo> {
  const number = String(trackingNumber).trim();
  const base: TrackingInfo = {
    trackingNumber: number,
    carrier: "CDEK",
    link: trackingLink(number),
    statusCode: null,
    statusDescription: null,
    delivered: false,
    events: [],
    registered: trackingEnabled(),
  };
  if (!number) return base;

  try {
    // gettrackinfo в v2.4 принимает [{ number, ... }]. Пробуем с number, при
    // ошибке «не зарегистрирован» — повторяем с guid (эквивалент номера).
    let data = await call17track("/gettrackinfo", [{ number }]);
    if (data && typeof data.code === "number" && data.code !== 0) {
      data = await call17track("/gettrackinfo", [{ guid: number }]);
    }
    const tr = data?.data?.track?.[0];
    if (!tr) return base;

    const info: any = tr.track_info ?? {};
    if (typeof info !== "object") return base;

    const latest: any = info.latest_status ?? {};
    const statusCode = typeof latest.status_code === "number" ? latest.status_code : null;

    const events: TrackingEvent[] = Array.isArray(info.events)
      ? info.events.map((e: any) => ({
          time: String(e.time_iso ?? e.time ?? ""),
          location: String(e.location ?? ""),
          description: String(e.description ?? ""),
        }))
      : [];

    return {
      ...base,
      trackingNumber: String(tr.number ?? number),
      carrier: String(tr.carrier_code ?? info.carrier_code ?? "CDEK"),
      statusCode,
      statusDescription: latest.status_description ? String(latest.status_description) : null,
      delivered: statusCode === 3,
      events,
    };
  } catch (e) {
    return base;
  }
}

/** Основной формат статуса 17TRACK для отображения. */
export function describe17trackStatus(info: TrackingInfo): string {
  if (info.statusCode === 3) return "📦 Доставлено";
  if (info.statusCode === 4) return "⚠️ Проблема с доставкой";
  if (info.statusCode === 2) return "🚚 В пути";
  return "🔎 Ожидает регистрации";
}