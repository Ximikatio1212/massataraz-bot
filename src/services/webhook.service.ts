import { timingSafeEqual } from "crypto";
import { prisma } from "../db/prisma";
import { logError } from "../utils/errors";

const KEEP_FOR_MS = 2 * 24 * 60 * 60 * 1000; // 2 дня хватит для защиты от ретраев

// Возвращает true, если апдейт ещё не обрабатывался (можно процессовать),
// false — если апдейт уже был обработан ранее (Telegram ретраит).
export async function markProcessedUpdate(updateId: number | undefined): Promise<boolean> {
  if (!updateId) return true; // без id не дедуплицируем

  try {
    await prisma.webhookUpdate.create({
      data: { updateId: BigInt(updateId) },
    });
    // Не критичная чистка старых записей
    try {
      await prisma.webhookUpdate.deleteMany({
        where: { processedAt: { lt: new Date(Date.now() - KEEP_FOR_MS) } },
      });
    } catch {
      // ignore
    }
    return true;
  } catch (e: any) {
    if (e?.code === "P2002") return false; // уже обработан
    logError("markProcessedUpdate", e, { updateId });
    return true; // ошибка БД — не блокируем обработку
  }
}

export function verifyWebhookSecret(header: string | undefined): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.warn("WEBHOOK_SECRET not configured — webhook accepts any request");
    return true;
  }
  if (!header) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}