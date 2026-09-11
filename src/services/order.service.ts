import { prisma } from "../db/prisma";
import { CartItemType, OrderStatus, PaymentStatus } from "@prisma/client";

export async function createOrder(userId: number) {
  const cart = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: true,
      course: { include: { items: { include: { product: true } } } },
    },
  });

  if (cart.length === 0) {
    throw new Error("CART_EMPTY");
  }

  // Validate cart before creating order
  for (const item of cart) {
    if (item.type === CartItemType.product) {
      const product = item.product;
      if (!product || !product.isActive) throw new Error("PRODUCT_UNAVAILABLE");
      if (product.stock < item.quantity) throw new Error("PRODUCT_NO_STOCK");
    } else if (item.type === CartItemType.course) {
      const course = item.course;
      if (!course || !course.isActive) throw new Error("COURSE_UNAVAILABLE");
      for (const ci of course.items) {
        if (!ci.product || !ci.product.isActive) throw new Error("COURSE_COMPONENT_UNAVAILABLE");
        const needed = ci.quantity * item.quantity;
        if (ci.product.stock < needed) throw new Error("COURSE_COMPONENT_NO_STOCK");
      }
    }
  }

  let total = 0;
  const orderItemsData = [];

  for (const item of cart) {
    if (item.type === CartItemType.product) {
      const product = item.product!;
      const subtotal = Number(product.price) * item.quantity;
      total += subtotal;
      orderItemsData.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
        subtotal,
      });
    } else if (item.type === CartItemType.course) {
      const course = item.course!;
      const subtotal = Number(course.price) * item.quantity;
      total += subtotal;
      orderItemsData.push({
        courseId: course.id,
        productName: `${course.name} (курс)`,
        price: course.price,
        quantity: item.quantity,
        subtotal,
      });
    }
  }

  const order = await prisma.order.create({
    data: {
      userId,
      total,
      status: OrderStatus.pending_payment,
      paymentStatus: PaymentStatus.pending,
      items: {
        create: orderItemsData,
      },
    },
  });

  return order;
}

export async function getOrderById(id: number) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return prisma.order.findUnique({
    where: { id },
    include: { items: true, payments: true, user: true },
  });
}

export async function getUserOrders(userId: number, offset = 0, limit = 10) {
  return prisma.order.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: { items: true },
  });
}

export async function countUserOrders(userId: number) {
  return prisma.order.count({ where: { userId } });
}

export async function getAllOrders(status?: OrderStatus, offset = 0, limit = 10) {
  return prisma.order.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: { items: true, user: true },
  });
}

export async function countOrders(statuses?: OrderStatus | OrderStatus[]) {
  const filter = Array.isArray(statuses)
    ? { status: { in: statuses } }
    : statuses
      ? { status: statuses }
      : undefined;
  return prisma.order.count({ where: filter });
}

export async function clearOrdersByStatus(statuses: OrderStatus[]) {
  const result = await prisma.order.deleteMany({
    where: { status: { in: statuses } },
  });
  return result.count;
}

// Удаляет ВСЕ заказы, связанные данные удаляются каскадно (OrderItem, Payment)
export async function deleteAllOrders(): Promise<number> {
  const result = await prisma.order.deleteMany({});
  return result.count;
}

export async function updateOrder(
  id: number,
  data: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    paidAt?: Date | null;
    receiptUrl?: string;
    receiptFileName?: string;
    receiptFileId?: string;
    receiptMimeType?: string;
    receiptSubmittedAt?: Date | null;
    fullName?: string;
    region?: string;
    city?: string;
    address?: string;
    phone?: string;
  }
) {
  return prisma.order.update({ where: { id }, data });
}

export async function getOrderCounts() {
  const [pendingVerification, processing, shipped, completed, waitingPayment] = await Promise.all([
    prisma.order.count({ where: { paymentStatus: PaymentStatus.pending_verification } }),
    prisma.order.count({ where: { status: OrderStatus.processing } }),
    prisma.order.count({ where: { status: OrderStatus.shipped } }),
    prisma.order.count({ where: { status: OrderStatus.completed } }),
    prisma.order.count({ where: { status: OrderStatus.pending_payment } }),
  ]);
  return { pendingVerification, processing, shipped, completed, waitingPayment };
}

export async function confirmOrderPayment(
  orderId: number
): Promise<{ ok: boolean; error?: string; order?: any }> {
  if (!Number.isInteger(orderId) || orderId <= 0) return { ok: false, error: "ORDER_NOT_FOUND" };
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: true,
          course: { include: { items: true } },
        },
      },
      user: true,
    },
  });

  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (order.paymentStatus === PaymentStatus.paid) return { ok: false, error: "ALREADY_PAID" };
  if (order.status === OrderStatus.cancelled) return { ok: false, error: "ORDER_CANCELLED" };

  // Deduct stock inside a transaction to prevent negative balances.
  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Prevent double confirmation / double stock deduction
      const current = await tx.order.findUnique({ where: { id: orderId } });
      if (!current) throw new Error("ORDER_NOT_FOUND");
      if (current.paymentStatus === PaymentStatus.paid) throw new Error("ALREADY_PAID");

      // Deduct stock for regular products
      const productItems = order.items.filter((i) => i.productId);
      for (const item of productItems) {
        const product = await tx.product.findUnique({ where: { id: item.productId! } });
        if (!product || !product.isActive) throw new Error("PRODUCT_UNAVAILABLE");
        if (product.stock < item.quantity) throw new Error("PRODUCT_NO_STOCK");
        await tx.product.update({
          where: { id: item.productId! },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Deduct stock for course components
      const courseItems = order.items.filter((i) => i.courseId);
      for (const item of courseItems) {
        const course = await tx.course.findUnique({
          where: { id: item.courseId! },
          include: { items: true },
        });
        if (!course) throw new Error("COURSE_UNAVAILABLE");
        for (const ci of course.items) {
          const product = await tx.product.findUnique({ where: { id: ci.productId } });
          if (!product || !product.isActive) throw new Error("COURSE_COMPONENT_UNAVAILABLE");
          const needed = ci.quantity * item.quantity;
          if (product.stock < needed) throw new Error("COURSE_COMPONENT_NO_STOCK");
          await tx.product.update({
            where: { id: ci.productId },
            data: { stock: { decrement: needed } },
          });
        }
      }

      return tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: PaymentStatus.paid,
          status: OrderStatus.processing,
          paidAt: new Date(),
        },
        include: { items: true, user: true },
      });
    });
    return { ok: true, order: updated };
  } catch (e: any) {
    if (
      e &&
      (e.message === "PRODUCT_NO_STOCK" ||
        e.message === "PRODUCT_UNAVAILABLE" ||
        e.message === "COURSE_COMPONENT_NO_STOCK" ||
        e.message === "COURSE_COMPONENT_UNAVAILABLE" ||
        e.message === "ORDER_NOT_FOUND" ||
        e.message === "ALREADY_PAID" ||
        e.message === "COURSE_UNAVAILABLE")
    ) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "UPDATE_FAILED" };
  }
}

export async function rejectOrderPayment(
  orderId: number,
  reason: string
): Promise<{ ok: boolean; error?: string; order?: any }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (order.paymentStatus === PaymentStatus.paid) return { ok: false, error: "ALREADY_PAID" };

  try {
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.rejected,
        status: OrderStatus.pending_payment,
      },
      include: { items: true, user: true },
    });
    return { ok: true, order: updated };
  } catch (e) {
    return { ok: false, error: "UPDATE_FAILED" };
  }
}

export async function completeReceiptSubmission(orderId: number) {
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new Error("ORDER_NOT_FOUND");

    await tx.order.update({
      where: { id: orderId },
      data: {
        paymentStatus: PaymentStatus.pending_verification,
        status: OrderStatus.pending_verification,
        receiptSubmittedAt: new Date(),
      },
    });
    await tx.cartItem.deleteMany({ where: { userId: order.userId } });
  });
}

export async function changeOrderStatus(orderId: number, status: OrderStatus) {
  return prisma.order.update({
    where: { id: orderId },
    data: { status },
  });
}