import { Handler } from "@netlify/functions";

export const handler: Handler = async (event) => {
  if ((event.headers?.["x-netlify-event"] ?? "") === "schedule") {
    const base = process.env.URL ?? "https://massa-taraz-bot.netlify.app";
    await Promise.allSettled([
      fetch(`${base}/.netlify/functions/app`),
      fetch(`${base}/.netlify/functions/telegram-webhook`),
    ]);
  }
  return { statusCode: 200, body: "ok" };
};