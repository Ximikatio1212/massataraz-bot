import "dotenv/config";
import { createBot } from "./bot/bot";
import { prisma } from "./db/prisma";

async function main() {
  await prisma.$connect();
  const bot = createBot();
  console.log("Massa Taraz bot starting in polling mode (local dev)...");
  await bot.init();
  await bot.start({
    onStart: (info) => console.log(`Bot @${info.username} started`),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});