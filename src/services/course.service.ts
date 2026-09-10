import { prisma } from "../db/prisma";

export async function getActiveCourses() {
  return prisma.course.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function getAllCourses() {
  return prisma.course.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function getCourseById(id: number) {
  return prisma.course.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
}

export async function createCourse(data: { name: string; price: number; description?: string; imageUrl?: string }) {
  return prisma.course.create({
    data: {
      name: data.name,
      price: data.price,
      description: data.description ?? null,
      imageUrl: data.imageUrl ?? null,
    },
  });
}

export async function updateCourse(
  id: number,
  data: { name?: string; price?: number; description?: string | null; imageUrl?: string | null; isActive?: boolean }
) {
  return prisma.course.update({
    where: { id },
    data,
  });
}

export async function toggleCourseActive(id: number, isActive: boolean) {
  return prisma.course.update({
    where: { id },
    data: { isActive },
  });
}

export async function addCourseItem(courseId: number, productId: number, quantity: number) {
  return prisma.courseItem.upsert({
    where: {
      courseId_productId: { courseId, productId },
    },
    update: { quantity },
    create: { courseId, productId, quantity },
  });
}

export async function removeCourseItem(courseId: number, productId: number) {
  return prisma.courseItem.deleteMany({
    where: { courseId, productId },
  });
}

export async function updateCourseItemQuantity(courseId: number, productId: number, quantity: number) {
  return prisma.courseItem.update({
    where: {
      courseId_productId: { courseId, productId },
    },
    data: { quantity },
  });
}

export async function getCourseItems(courseId: number) {
  return prisma.courseItem.findMany({
    where: { courseId },
    include: { product: true },
  });
}

export async function courseIsAvailable(courseId: number): Promise<boolean> {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { items: true },
  });
  if (!course || !course.isActive) return false;
  if (course.items.length === 0) return false;

  for (const item of course.items) {
    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product || !product.isActive) return false;
    if (product.stock < item.quantity) return false;
  }
  return true;
}