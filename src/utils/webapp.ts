import { createHmac, timingSafeEqual } from "crypto";

// Валидация initData Telegram Mini App.
// Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// 1. строка из пар key=value (без hash), отсортированных по ключу, через \n
// 2. secret_key = HMAC_SHA256(bot_token, "WebAppData")
// 3. hash = HMAC_SHA256(data_check_string, secret_key)

const AUTH_MAX_AGE_SEC = 24 * 60 * 60;

export interface WebAppUser {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface VerifiedInitData {
  userId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  langCode?: string;
  authDate: number;
  raw: Record<string, string>;
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function verifyWebAppInitData(
  initData: string,
  botToken?: string
): VerifiedInitData | null {
  const token = botToken ?? process.env.BOT_TOKEN;
  if (!token || !initData) return null;

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return null;
  }
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const pairs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort();
  const checkString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(token).digest();
  const calcHash = createHmac("sha256", secretKey).update(checkString).digest();

  if (!safeEqual(Buffer.from(hash, "hex"), calcHash)) return null;

  // Свежесть: auth_date не старше 24 часов.
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Math.abs(Date.now() / 1000 - authDate) > AUTH_MAX_AGE_SEC) return null;

  let user: Partial<WebAppUser> = {};
  try {
    user = JSON.parse(params.get("user") ?? "{}");
  } catch {}

  const userId = Number(user.id);
  if (!Number.isInteger(userId) || userId <= 0) return null;

  const raw: Record<string, string> = {};
  params.forEach((v, k) => {
    raw[k] = v;
  });
  raw.hash = hash;

  return {
    userId,
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    langCode: user.language_code,
    authDate,
    raw,
  };
}