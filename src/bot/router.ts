import { BotContext } from "./middleware/auth";
import { startHandler, handleLangSet } from "./handlers/start";
import { handleCatalogStart, handleCategoryView } from "./handlers/catalog";
import { handleProductView, handleProductAdd } from "./handlers/products";
import { handleCoursesList, handleCourseView, handleCourseAdd } from "./handlers/courses";
import {
  handleCartView,
  handleCartItemView,
  handleCartInc,
  handleCartDec,
  handleCartDel,
  handleCartClear,
} from "./handlers/cart";
import {
  handleCheckoutStart,
  handleCheckoutConfirm,
  handleCheckoutCancel,
  handleCheckoutEdit,
  handleCheckoutReceipt,
  handleCheckoutData,
} from "./handlers/checkout";
import { handleOrdersList, handleOrderView } from "./handlers/orders";
import {
  handleAdminMenu,
  handleAdminProducts,
  handleAdminCategories,
  handleAdminCourses,
  handleAdminOrders,
  handleAdminPayments,
  handleAdminStatistics,
  handleAdminProductCreateCommand,
  handleAdminCategoryCreateCommand,
  handleAdminCourseCreateCommand,
  handleAdminProductList,
  handleAdminProductHidden,
  handleAdminCategoryList,
  handleAdminCategoryHidden,
  handleAdminCourseList,
  handleAdminCourseHidden,
  handleAdminProductView,
  handleAdminCategoryView,
  handleAdminCourseView,
  handleAdminProductEdit,
  handleAdminCategoryEdit,
  handleAdminCourseEdit,
  handleAdminCourseItemsAdd,
  handleAdminCourseItemsList,
  handleAdminAddCourseItem,
  handleAdminCourseCreateNoImage,
  handleAdminCourseCreateConfirm,
  handleAdminCourseCreateAddItem,
  handleAdminCourseCreateItem,
  handleAdminCourseCreateItemConfirm,
  handleAdminProductCreateCat,
  handleAdminProductCreateNoImage,
  handleAdminProductCreateConfirm,
  handleAdminCategoryCreateNoImage,
  handleAdminCategoryCreateConfirm,
  handleAdminOrderListByFilter,
  handleAdminOrderStatus,
  handleAdminOrderSetStatus,
  handleAdminClearOrders,
  handleAdminClearOrdersConfirm,
  handleAdminClearAllOrders,
  handleAdminClearAllOrdersConfirm,
  handleAdminPaymentList,
  handleAdminPaymentConfirm,
  handleAdminPaymentReject,
  handleAdminReceipt,
  handleAdminProductToggle,
  handleAdminCategoryToggle,
  handleAdminCourseToggle,
  handleAdminProductDelete,
  handleAdminCategoryDelete,
  handleAdminCourseDelete,
  handleAdminRemoveCourseItem,
  handleCancelCurrent,
} from "./handlers/admin";
import { handleClientView, handleAdminClients } from "./handlers/adminClients";
import { handleAssistantStart, handleAssistantStop } from "./handlers/assistant";

export async function handleCallback(ctx: BotContext, data: string) {
  if (!ctx.state.user) return;
  const parts = data.split(":");
  const scope = parts[0];

  switch (scope) {
    case "assistant":
      if (parts[1] === "start") return handleAssistantStart(ctx);
      if (parts[1] === "stop") return handleAssistantStop(ctx);
      break;

    case "main":
      if (parts[1] === "menu") return startHandler(ctx);
      break;

    case "lang":
      if (parts[1] === "ru") return handleLangSet(ctx, "ru");
      if (parts[1] === "kk") return handleLangSet(ctx, "kk");
      break;

    case "catalog":
      if (parts[1] === "start") return handleCatalogStart(ctx);
      break;

    case "category":
      if (parts[1] === "view") return handleCategoryView(ctx, Number(parts[2]));
      break;

    case "product":
      if (parts[1] === "view") return handleProductView(ctx, Number(parts[2]));
      if (parts[1] === "add") return handleProductAdd(ctx, Number(parts[2]));
      break;

    case "courses":
      if (parts[1] === "list") return handleCoursesList(ctx);
      break;

    case "course":
      if (parts[1] === "view") return handleCourseView(ctx, Number(parts[2]));
      if (parts[1] === "add") return handleCourseAdd(ctx, Number(parts[2]));
      break;

    case "cart":
      if (parts[1] === "view") return handleCartView(ctx);
      if (parts[1] === "clear") return handleCartClear(ctx);
      if (parts[1] === "item") {
        const op = parts[2];
        const cartItemId = Number(parts[3]);
        if (op === "view") return handleCartItemView(ctx, cartItemId);
        if (op === "inc") return handleCartInc(ctx, cartItemId);
        if (op === "dec") return handleCartDec(ctx, cartItemId);
        if (op === "del") return handleCartDel(ctx, cartItemId);
      }
      break;

    case "checkout":
      if (parts[1] === "start") return handleCheckoutStart(ctx);
      if (parts[1] === "confirm") return handleCheckoutConfirm(ctx);
      if (parts[1] === "cancel") return handleCheckoutCancel(ctx);
      if (parts[1] === "edit") return handleCheckoutEdit(ctx);
      if (parts[1] === "receipt") return handleCheckoutReceipt(ctx);
      if (parts[1] === "data") return handleCheckoutData(ctx);
      break;

    case "order":
      if (parts[1] === "view") return handleOrderView(ctx, Number(parts[2]));
      break;

    case "orders":
      if (parts[1] === "list") return handleOrdersList(ctx, parts[2] ? Number(parts[2]) : 0);
      break;

    case "cancel":
      if (parts[1] === "current") return handleCancelCurrent(ctx);
      break;

    case "restart":
      if (parts[1] === "current") return handleRestartCurrent(ctx);
      break;

    case "admin":
      return handleAdminCallback(ctx, parts);

    default:
      break;
  }
}

async function handleRestartCurrent(ctx: BotContext) {
  if (!ctx.state.user?.isAdmin) return;
  const { getState } = await import("../services/state.service");
  const { getUserByTelegramId } = await import("../services/user.service");
  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return;
  const state = await getState(dbUser.id);
  const s = state?.state ?? "";
  if (String(s).startsWith("WAITING_PRODUCT")) return handleAdminProductCreateCommand(ctx);
  if (String(s).startsWith("WAITING_CATEGORY")) return handleAdminCategoryCreateCommand(ctx);
  if (String(s).startsWith("WAITING_COURSE")) return handleAdminCourseCreateCommand(ctx);
  return handleCancelCurrent(ctx);
}

async function handleAdminCallback(ctx: BotContext, parts: string[]) {
  const sub = parts[1];

  switch (sub) {
    case "menu":
      return handleAdminMenu(ctx);
    case "products":
      return handleAdminProducts(ctx);
    case "categories":
      return handleAdminCategories(ctx);
    case "courses":
      return handleAdminCourses(ctx);
    case "orders":
      return handleAdminOrders(ctx);
    case "payments":
      return handleAdminPayments(ctx);
    case "clients":
      return handleAdminClients(ctx, 0);
    case "statistics":
      return handleAdminStatistics(ctx);

    case "product": {
      const action = parts[2];
      if (action === "create") {
        if (parts[3] === "start") return handleAdminProductCreateCommand(ctx);
        if (parts[3] === "cat") return handleAdminProductCreateCat(ctx, Number(parts[4]));
        if (parts[3] === "noimage") return handleAdminProductCreateNoImage(ctx);
        if (parts[3] === "confirm") return handleAdminProductCreateConfirm(ctx);
        if (parts[3] === "edit") return handleAdminProductCreateCommand(ctx);
      }
      if (action === "list") return handleAdminProductList(ctx, parts[3] ? Number(parts[3]) : 0);
      if (action === "hidden") return handleAdminProductHidden(ctx);
      if (action === "view") return handleAdminProductView(ctx, Number(parts[3]));
      if (action === "toggle") return handleAdminProductToggle(ctx, Number(parts[3]));
      if (action === "edit") return handleAdminProductEdit(ctx, parts[3], Number(parts[4]));
      if (action === "delete") {
        if (parts[3] === "yes") return handleAdminProductDelete(ctx, Number(parts[4]), true);
        if (parts[3] === "no") return handleAdminProductView(ctx, Number(parts[4]));
        return handleAdminProductDelete(ctx, Number(parts[3]));
      }
      break;
    }

    case "category": {
      const action = parts[2];
      if (action === "create") {
        if (parts[3] === "start") return handleAdminCategoryCreateCommand(ctx);
        if (parts[3] === "noimage") return handleAdminCategoryCreateNoImage(ctx);
        if (parts[3] === "confirm") return handleAdminCategoryCreateConfirm(ctx);
        if (parts[3] === "edit") return handleAdminCategoryCreateCommand(ctx);
      }
      if (action === "list") return handleAdminCategoryList(ctx, parts[3] ? Number(parts[3]) : 0);
      if (action === "hidden") return handleAdminCategoryHidden(ctx);
      if (action === "view") return handleAdminCategoryView(ctx, Number(parts[3]));
      if (action === "toggle") return handleAdminCategoryToggle(ctx, Number(parts[3]));
      if (action === "edit") return handleAdminCategoryEdit(ctx, parts[3], Number(parts[4]));
      if (action === "delete") {
        if (parts[3] === "yes") return handleAdminCategoryDelete(ctx, Number(parts[4]), true);
        if (parts[3] === "no") return handleAdminCategoryView(ctx, Number(parts[4]));
        return handleAdminCategoryDelete(ctx, Number(parts[3]));
      }
      break;
    }

    case "course": {
      const action = parts[2];
      if (action === "create") {
        if (parts[3] === "start") return handleAdminCourseCreateCommand(ctx);
        if (parts[3] === "noimage") return handleAdminCourseCreateNoImage(ctx);
        if (parts[3] === "confirm") return handleAdminCourseCreateConfirm(ctx);
        if (parts[3] === "edit") return handleAdminCourseCreateCommand(ctx);
        if (parts[3] === "additem") return handleAdminCourseCreateAddItem(ctx);
        if (parts[3] === "item") return handleAdminCourseCreateItem(ctx, Number(parts[4]));
        if (parts[3] === "itemconfirm") return handleAdminCourseCreateItemConfirm(ctx);
      }
      if (action === "list") return handleAdminCourseList(ctx, parts[3] ? Number(parts[3]) : 0);
      if (action === "hidden") return handleAdminCourseHidden(ctx);
      if (action === "view") return handleAdminCourseView(ctx, Number(parts[3]));
      if (action === "toggle") return handleAdminCourseToggle(ctx, Number(parts[3]));
      if (action === "edit") return handleAdminCourseEdit(ctx, parts[3], Number(parts[4]));
      if (action === "delete") {
        if (parts[3] === "yes") return handleAdminCourseDelete(ctx, Number(parts[4]), true);
        if (parts[3] === "no") return handleAdminCourseView(ctx, Number(parts[4]));
        return handleAdminCourseDelete(ctx, Number(parts[3]));
      }
      if (action === "items") {
        if (parts[3] === "add") return handleAdminCourseItemsAdd(ctx, Number(parts[4]));
        if (parts[3] === "list") return handleAdminCourseItemsList(ctx, Number(parts[4]));
      }
      if (action === "additem") {
        const courseId = Number(parts[3]);
        const productId = Number(parts[4]);
        return handleAdminAddCourseItem(ctx, courseId, productId);
      }
      if (action === "remitem") {
        const courseId = Number(parts[3]);
        const productId = Number(parts[4]);
        return handleAdminRemoveCourseItem(ctx, courseId, productId);
      }
      break;
    }

    case "order": {
      const action = parts[2];
      if (action === "list") return handleAdminOrderListByFilter(ctx, parts[3], parts[4] ? Number(parts[4]) : 0);
      if (action === "status") return handleAdminOrderStatus(ctx, Number(parts[3]));
      if (action === "setstatus") return handleAdminOrderSetStatus(ctx, parts[3], Number(parts[4]));
      if (action === "clearall") {
        if (parts[3] === "yes") return handleAdminClearAllOrdersConfirm(ctx, true);
        if (parts[3] === "no") return handleAdminClearAllOrdersConfirm(ctx, false);
        return handleAdminClearAllOrders(ctx);
      }
      if (action === "clear") {
        if (parts[3] === "yes") return handleAdminClearOrdersConfirm(ctx, parts[4], true);
        return handleAdminClearOrders(ctx, parts[3]);
      }
      break;
    }

    case "payment": {
      const action = parts[2];
      if (action === "list") return handleAdminPaymentList(ctx, parts[3]);
      if (action === "confirm") return handleAdminPaymentConfirm(ctx, Number(parts[3]));
      if (action === "reject") return handleAdminPaymentReject(ctx, Number(parts[3]));
      break;
    }

    case "receipt":
      if (parts[2] === "show") return handleAdminReceipt(ctx, Number(parts[3]));
      return handleAdminReceipt(ctx, Number(parts[2]));

    case "client":
      if (parts[2] === "view") return handleClientView(ctx, Number(parts[3]));
      if (parts[2] === "list") return handleAdminClients(ctx, parts[3] ? Number(parts[3]) : 0);
      break;

    default:
      break;
  }
}

export async function handleTextMessage(ctx: BotContext): Promise<boolean> {
  if (!ctx.state.user || !ctx.message?.text) return false;
  const { processOrderText } = await import("./handlers/checkout");
  const { processAdminText } = await import("./handlers/admin");
  const { getState } = await import("../services/state.service");
  const { getUserByTelegramId } = await import("../services/user.service");
  const { ConversationState } = await import("@prisma/client");

  const dbUser = await getUserByTelegramId(ctx.state.user.telegramId);
  if (!dbUser) return false;

  const state = await getState(dbUser.id);
  if (!state || state.state === ConversationState.NONE) return false;

  if (
    state.state === ConversationState.WAITING_ORDER_NAME ||
    state.state === ConversationState.WAITING_ORDER_REGION ||
    state.state === ConversationState.WAITING_ORDER_CITY ||
    state.state === ConversationState.WAITING_ORDER_ADDRESS ||
    state.state === ConversationState.WAITING_ORDER_POSTAL ||
    state.state === ConversationState.WAITING_ORDER_PHONE
  ) {
    await processOrderText(ctx, state, ctx.message.text);
    return true;
  }

  // Чек принимается только фото/документом (handleReceiptUpload). Текстовое
  // сообщение в состоянии WAITING_RECEIPT — это вопрос к ассистенту, а не чек:
  // не блокируем его и даём уйти в ИИ.
  if (state.state === ConversationState.WAITING_RECEIPT) return false;

  await processAdminText(ctx, state, ctx.message.text);
  return true;
}

export async function handleReceiptUpload(ctx: BotContext): Promise<boolean> {
  if (!ctx.state.user) return false;
  const { processReceiptMessage } = await import("./handlers/payments");
  return processReceiptMessage(ctx);
}

export async function handleAdminPhoto(ctx: BotContext): Promise<boolean> {
  if (!ctx.state.user || !ctx.message?.photo) return false;
  const { processAdminPhoto } = await import("./handlers/admin");
  return processAdminPhoto(ctx);
}

export async function handleAdminDocument(ctx: BotContext) {
  if (!ctx.state.user || !ctx.message?.document) return;
  // Documents are handled by receipt processing only.
}