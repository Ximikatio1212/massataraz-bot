import { prisma } from "../db/prisma";

export async function getActiveProductsByCategory(categoryId: number) {
  return prisma.product.findMany({
    where: { categoryId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function getActiveProducts() {
  return prisma.product.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: { category: true },
  });
}

export async function getAllProducts(showInactiveOnly = false) {
  return prisma.product.findMany({
    where: showInactiveOnly ? { isActive: false } : undefined,
    orderBy: { createdAt: "asc" },
    include: { category: true },
  });
}

export async function getProductById(id: number) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
}

export async function createProduct(data: {
  name: string;
  price: number;
  description?: string;
  categoryId: number;
  stock?: number;
  imageUrl?: string;
}) {
  return prisma.product.create({
    data: {
      name: data.name,
      price: data.price,
      description: data.description ?? null,
      categoryId: data.categoryId,
      stock: data.stock ?? 0,
      imageUrl: data.imageUrl ?? null,
    },
  });
}

export async function updateProduct(
  id: number,
  data: {
    name?: string;
    price?: number;
    description?: string | null;
    categoryId?: number;
    stock?: number;
    imageUrl?: string | null;
    isActive?: boolean;
  }
) {
  return prisma.product.update({
    where: { id },
    data,
  });
}

export async function toggleProductActive(id: number, isActive: boolean) {
  return prisma.product.update({
    where: { id },
    data: { isActive },
  });
}

export async function productHasStock(id: number): Promise<boolean> {
  const product = await prisma.product.findUnique({ where: { id } });
  return !!product && product.isActive && product.stock > 0;
}

export async function getLowStockProducts(threshold = 5) {
  return prisma.product.findMany({
    where: { isActive: true, stock: { lte: threshold } },
    orderBy: { stock: "asc" },
  });
}

export async function productInCourses(id: number): Promise<boolean> {
  const count = await prisma.courseItem.count({ where: { productId: id } });
  return count > 0;
}

export async function productInOrders(id: number): Promise<boolean> {
  const count = await prisma.orderItem.count({ where: { productId: id } });
  return count > 0;
}

export async function deleteProduct(id: number): Promise<{ ok: boolean; error?: string }> {
  if (await productInCourses(id)) return { ok: false, error: "PRODUCT_IN_COURSE" };
  if (await productInOrders(id)) return { ok: false, error: "PRODUCT_IN_ORDERS" };
  try {
    await prisma.product.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: "UPDATE_FAILED" };
  }
}