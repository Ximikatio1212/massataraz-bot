import { prisma } from "../db/prisma";
import { CartItemType } from "@prisma/client";

export async function getCart(userId: number) {
  const items = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: true,
      course: {
        include: {
          items: { include: { product: true } },
        },
      },
    },
  });
  return items;
}

export async function addProductToCart(userId: number, productId: number, quantity = 1) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.isActive) {
    throw new Error("PRODUCT_UNAVAILABLE");
  }
  if (product.stock < 1) {
    throw new Error("PRODUCT_NO_STOCK");
  }

  return prisma.cartItem.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    update: {
      quantity: { increment: quantity },
      type: CartItemType.product,
    },
    create: {
      userId,
      productId,
      type: CartItemType.product,
      quantity,
    },
  });
}

export async function addCourseToCart(userId: number, courseId: number, quantity = 1) {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: { items: { include: { product: true } } },
  });
  if (!course || !course.isActive) {
    throw new Error("COURSE_UNAVAILABLE");
  }
  if (course.items.length === 0) {
    throw new Error("COURSE_EMPTY");
  }
  for (const item of course.items) {
    if (!item.product || !item.product.isActive) {
      throw new Error("COURSE_COMPONENT_UNAVAILABLE");
    }
    if (item.product.stock < item.quantity) {
      throw new Error("COURSE_COMPONENT_NO_STOCK");
    }
  }

  return prisma.cartItem.upsert({
    where: {
      userId_courseId: { userId, courseId },
    },
    update: {
      quantity: { increment: quantity },
      type: CartItemType.course,
    },
    create: {
      userId,
      courseId,
      type: CartItemType.course,
      quantity,
    },
  });
}

export async function increaseCartItem(cartItemId: number, userId: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: cartItemId, userId } });
  if (!item) throw new Error("CART_ITEM_NOT_FOUND");

  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: { increment: 1 } },
  });
}

export async function decreaseCartItem(cartItemId: number, userId: number) {
  const item = await prisma.cartItem.findFirst({ where: { id: cartItemId, userId } });
  if (!item) throw new Error("CART_ITEM_NOT_FOUND");

  if (item.quantity <= 1) {
    await prisma.cartItem.delete({ where: { id: cartItemId } });
    return;
  }
  await prisma.cartItem.update({
    where: { id: cartItemId },
    data: { quantity: { decrement: 1 } },
  });
}

export async function deleteCartItem(cartItemId: number, userId: number) {
  await prisma.cartItem.deleteMany({ where: { id: cartItemId, userId } });
}

export async function clearCart(userId: number) {
  await prisma.cartItem.deleteMany({ where: { userId } });
}

export async function getCartSummary(userId: number) {
  const items = await getCart(userId);
  const normalized = items.map((item) => {
    if (item.type === CartItemType.course && item.course) {
      return {
        cartItemId: item.id,
        type: "course" as const,
        id: item.course.id,
        name: item.course.name,
        price: Number(item.course.price),
        quantity: item.quantity,
        subtotal: Number(item.course.price) * item.quantity,
      };
    }
    if (item.product) {
      return {
        cartItemId: item.id,
        type: "product" as const,
        id: item.product.id,
        name: item.product.name,
        price: Number(item.product.price),
        quantity: item.quantity,
        subtotal: Number(item.product.price) * item.quantity,
      };
    }
    return null;
  }).filter((i): i is NonNullable<typeof i> => i !== null);

  const total = normalized.reduce((sum, i) => sum + i.subtotal, 0);
  return { items: normalized, total };
}

export async function getCartItemById(cartItemId: number, userId: number) {
  return prisma.cartItem.findFirst({ where: { id: cartItemId, userId } });
}

export async function validateCartForOrder(userId: number): Promise<{ ok: boolean; error?: string; total: number }> {
  const items = await getCart(userId);
  if (items.length === 0) {
    return { ok: false, error: "CART_EMPTY", total: 0 };
  }

  let total = 0;

  for (const item of items) {
    if (item.type === CartItemType.product) {
      const product = await prisma.product.findUnique({ where: { id: item.productId! } });
      if (!product || !product.isActive) {
        return { ok: false, error: `PRODUCT_UNAVAILABLE`, total: 0 };
      }
      if (product.stock < item.quantity) {
        return { ok: false, error: "PRODUCT_NO_STOCK", total: 0 };
      }
      total += Number(product.price) * item.quantity;
    } else if (item.type === CartItemType.course) {
      const course = await prisma.course.findUnique({
        where: { id: item.courseId! },
        include: { items: { include: { product: true } } },
      });
      if (!course || !course.isActive) {
        return { ok: false, error: "COURSE_UNAVAILABLE", total: 0 };
      }
      for (const ci of course.items) {
        if (!ci.product || !ci.product.isActive) {
          return { ok: false, error: "COURSE_COMPONENT_UNAVAILABLE", total: 0 };
        }
        if (ci.product.stock < ci.quantity * item.quantity) {
          return { ok: false, error: "COURSE_COMPONENT_NO_STOCK", total: 0 };
        }
      }
      total += Number(course.price) * item.quantity;
    }
  }

  return { ok: true, total };
}