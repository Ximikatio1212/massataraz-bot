import { prisma } from "../db/prisma";

export async function getActiveCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { products: { where: { isActive: true } } },
      },
    },
  });
}

export async function getAllCategories() {
  return prisma.category.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: {
        select: { products: true },
      },
    },
  });
}

export async function getCategoryById(id: number) {
  return prisma.category.findUnique({ where: { id } });
}

export async function createCategory(data: { name: string; description?: string; imageUrl?: string }) {
  return prisma.category.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
    },
  });
}

export async function updateCategory(
  id: number,
  data: { name?: string; description?: string | null; imageUrl?: string | null; isActive?: boolean }
) {
  return prisma.category.update({
    where: { id },
    data,
  });
}

export async function toggleCategoryActive(id: number, isActive: boolean) {
  return prisma.category.update({
    where: { id },
    data: { isActive },
  });
}

export async function deleteCategorySoft(id: number) {
  return prisma.category.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function deleteCategoryHard(id: number): Promise<{ ok: boolean; error?: string }> {
  const hasProducts = await categoryHasProducts(id);
  if (hasProducts) return { ok: false, error: "CATEGORY_HAS_PRODUCTS" };
  try {
    await prisma.category.delete({ where: { id } });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "UPDATE_FAILED" };
  }
}

export async function categoryHasProducts(id: number): Promise<boolean> {
  const count = await prisma.product.count({ where: { categoryId: id } });
  return count > 0;
}