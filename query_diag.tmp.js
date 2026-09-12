const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const replacer = (k, v) => (typeof v === "bigint" ? v.toString() : v);
p.webhookDiag
  .findMany({ orderBy: { id: "desc" }, take: 25, select: { id: true, updateId: true, chatId: true, reply: true, replyMethod: true, noReplyReason: true, error: true, diag: true } })
  .then((r) => { console.log(JSON.stringify(r, replacer)); return p.$disconnect(); })
  .catch((e) => { console.error("ERR:" + e.message); return p.$disconnect(); });