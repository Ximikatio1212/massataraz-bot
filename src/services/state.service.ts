import { prisma } from "../db/prisma";
import { ConversationState } from "@prisma/client";

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
      payload: null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      state: ConversationState.NONE,
      payload: null,
    },
  });
}

export async function getCurrentState(userId: number): Promise<ConversationState> {
  const state = await prisma.userState.findUnique({ where: { userId } });
  return state?.state ?? ConversationState.NONE;
}