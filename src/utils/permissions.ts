const ADMIN_IDS = parseAdminIds();

function parseAdminIds(): Set<bigint> {
  const raw = process.env.ADMIN_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      try {
        return BigInt(s);
      } catch {
        return null;
      }
    })
    .filter(Boolean) as bigint[];
  return new Set(ids);
}

export function isAdmin(telegramId: bigint): boolean {
  return ADMIN_IDS.has(telegramId);
}

export function assertIsAdmin(telegramId: bigint): boolean {
  return isAdmin(telegramId);
}