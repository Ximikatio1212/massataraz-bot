import { prisma } from "../db/prisma";
import { ConversationState, Prisma } from "@prisma/client";

export async function setState(userId: number, state: ConversationState, payload: unknown = {}) {
  await prisma.userState.upsert({
    where: { userId },
    update: {
      state,
      payload: payload as any,
      updatedAt: new Date(),
    },
    create: {
      userId,
      state,
      payload: payload as any,
    },
  });
}

export async function getState(userId: number) {
  const state = await prisma.userState.findUnique({ where: { userId } });
  return state;
}

export async function resetState(userId: number) {
  await prisma.userState.upsert({
    where: { userId },
    update: {
      state: ConversationState.NONE,
      payload: Prisma.JsonNull,
      updatedAt: new Date(),
    },
    create: {
      userId,
      state: ConversationState.NONE,
      payload: Prisma.JsonNull,
    },
  });
}

export async function getCurrentState(userId: number): Promise<ConversationState> {
  const state = await prisma.userState.findUnique({ where: { userId } });
  return state?.state ?? ConversationState.NONE;
}

export async function getCanvas(
  userId: number
): Promise<{ chatId: bigint; messageId: number } | null> {
  const state = await prisma.userState.findUnique({
    where: { userId },
    select: { canvasChatId: true, canvasMessageId: true },
  });
  if (!state?.canvasMessageId || !state.canvasChatId) return null;
  return { chatId: state.canvasChatId, messageId: state.canvasMessageId };
}

export async function saveCanvas(userId: number, chatId: bigint, messageId: number) {
  await prisma.userState.upsert({
    where: { userId },
    update: { canvasChatId: chatId, canvasMessageId: messageId, updatedAt: new Date() },
    create: { userId, canvasChatId: chatId, canvasMessageId: messageId },
  });
}

export async function clearCanvas(userId: number) {
  await prisma.userState.upsert({
    where: { userId },
    update: { canvasChatId: null, canvasMessageId: null, updatedAt: new Date() },
    create: { userId },
  });
}
