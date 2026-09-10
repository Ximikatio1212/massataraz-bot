import type { Handler } from "@netlify/functions";
import { processUpdate } from "../../src/bot/bot";
import { logError } from "../../src/utils/errors";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
    };
  }

  if (!event.body) {
    return {
      statusCode: 400,
      body: "Bad Request",
    };
  }

  let update: any;
  try {
    update = JSON.parse(event.body);
  } catch (e) {
    return {
      statusCode: 400,
      body: "Invalid JSON",
    };
  }

  try {
    await processUpdate(update);
  } catch (e) {
    logError("telegram-webhook", e, {
      updateId: update?.update_id,
    });
  }

  // Always respond 200; Telegram will retry otherwise.
  return {
    statusCode: 200,
    body: "ok",
  };
};