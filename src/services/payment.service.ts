import { prisma } from "../db/prisma";
import { PaymentStatus } from "@prisma/client";

export async function createPaymentRecord(
  orderId: number,
  userId: number,
  amount: number,
  receiptUrl?: string,
  receiptFileName?: string,
  receiptFileId?: string,
  receiptMimeType?: string
) {
  return prisma.payment.create({
    data: {
      orderId,
      userId,
      amount,
      status: PaymentStatus.pending_verification,
      receiptUrl,
      receiptFileName,
      receiptFileId,
      receiptMimeType,
    },
  });
}

export async function getPaymentById(id: number) {
  return prisma.payment.findUnique({ where: { id } });
}

export async function getPaymentsByOrder(orderId: number) {
  return prisma.payment.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPaymentsByStatus(status: PaymentStatus) {
  return prisma.payment.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    include: { order: true, user: true },
  });
}

export async function updatePaymentStatus(id: number, status: PaymentStatus, reason?: string) {
  return prisma.payment.update({
    where: { id },
    data: { status, reason: reason ?? null },
  });
}