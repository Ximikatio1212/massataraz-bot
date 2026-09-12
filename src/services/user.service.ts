import { prisma } from "../db/prisma";

export async function getOrCreateUser(telegramId: bigint, username?: string, firstName?: string, lastName?: string) {
  const existing = await prisma.user.findUnique({
    where: { telegramId },
    include: {
      state: true,
    },
  });

  if (existing) {
    if (username !== undefined || firstName !== undefined || lastName !== undefined) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          username: username ?? existing.username,
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
        },
      });
    }
    return { ...existing, wasCreated: false };
  }

  const user = await prisma.user.create({
    data: {
      telegramId,
      username,
      firstName,
      lastName,
      role: "user",
      aiMode: true, // ИИ-консультант по умолчанию включён; клиент может выключить кнопкой
    },
    include: {
      state: true,
    },
  });

  return { ...user, wasCreated: true };
}

export async function getUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByTelegramId(telegramId: bigint) {
  return prisma.user.findUnique({
    where: { telegramId },
    include: { state: true },
  });
}

export async function getAllUsers(limit = 50, offset = 0) {
  return prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      _count: {
        select: { orders: true },
      },
    },
  });
}

export async function getUsersCount() {
  return prisma.user.count();
}

export async function getAdminContactInfo(userId: number): Promise<{ telegramId: bigint; firstName: string | null } | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return { telegramId: user.telegramId, firstName: user.firstName };
}