import { Context } from "grammy";
import { t, langOf } from "../i18n";

export function userFriendlyError(code: string, lang?: string): string {
  const msg = t(lang, `err_${code}`);
  if (msg === `err_${code}`) return t(lang, "err_GENERIC");
  return msg;
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