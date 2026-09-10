import { prisma } from "../db/prisma";
import { OrderStatus, PaymentStatus } from "@prisma/client";

export interface Statistics {
  usersCount: number;
  ordersCount: number;
  totalSales: number;
  paidOrdersCount: number;
  pendingVerificationOrdersCount: number;
  activeProductsCount: number;
  lowStockProductsCount: number;
  topProducts: { name: string; quantity: number }[];
  topCourses: { name: string; quantity: number }[];
  lowStockProducts: { id: number; name: string; stock: number }[];
}

export async function getStatistics(): Promise<Statistics> {
  const [
    usersCount,
    ordersCount,
    paidOrdersCount,
    pendingVerificationOrdersCount,
    activeProductsCount,
    lowStockProducts,
    salesAggregation,
    topProductRows,
    topCourseAggregation,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.order.count({ where: { paymentStatus: PaymentStatus.paid } }),
    prisma.order.count({ where: { paymentStatus: PaymentStatus.pending_verification } }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      where: { isActive: true, stock: { lte: 5 } },
      orderBy: { stock: "asc" },
      take: 10,
    }),
    prisma.order.aggregate({
      where: { paymentStatus: PaymentStatus.paid },
      _sum: { total: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { productId: { not: null } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
    prisma.orderItem.groupBy({
      by: ["courseId"],
      where: { courseId: { not: null } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 10,
    }),
  ]);

  const topProducts: { name: string; quantity: number }[] = [];
  for (const row of topProductRows) {
    if (!row.productId) continue;
    const product = await prisma.product.findUnique({ where: { id: row.productId } });
    topProducts.push({
      name: product?.name ?? `Товар #${row.productId}`,
      quantity: row._sum.quantity ?? 0,
    });
  }

  const topCourses: { name: string; quantity: number }[] = [];
  for (const row of topCourseAggregation) {
    if (!row.courseId) continue;
    const course = await prisma.course.findUnique({ where: { id: row.courseId } });
    topCourses.push({
      name: course?.name ?? `Курс #${row.courseId}`,
      quantity: row._sum.quantity ?? 0,
    });
  }

  return {
    usersCount,
    ordersCount,
    totalSales: Number(salesAggregation._sum.total ?? 0),
    paidOrdersCount,
    pendingVerificationOrdersCount,
    activeProductsCount,
    lowStockProductsCount: lowStockProducts.length,
    topProducts,
    topCourses,
    lowStockProducts: lowStockProducts.map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
  };
}

export async function getOrderCountsByStatus() {
  const [pendingVerification, processing, shipped, completed, cancelled, pendingPayment] = await Promise.all([
    prisma.order.count({ where: { paymentStatus: PaymentStatus.pending_verification } }),
    prisma.order.count({ where: { status: OrderStatus.processing } }),
    prisma.order.count({ where: { status: OrderStatus.shipped } }),
    prisma.order.count({ where: { status: OrderStatus.completed } }),
    prisma.order.count({ where: { status: OrderStatus.cancelled } }),
    prisma.order.count({ where: { status: OrderStatus.pending_payment } }),
  ]);
  return { pendingVerification, processing, shipped, completed, cancelled, pendingPayment };
}