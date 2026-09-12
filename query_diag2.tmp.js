const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
const replacer = (k, v) => (typeof v === "bigint" ? v.toString() : v);
p.webhookDiag
  .findMany({ orderBy: { id: "desc" }, take: 120, select: { id: true, chatId: true, reply: true, replyMethod: true, noReplyReason: true, error: true, diag: true } })
  .then((r) => {
    const admins = new Set(["6265624643", "8036360267"]);
    const rows = r.filter((x) => !admins.has(String(x.chatId)) || !x.reply);
    console.log(JSON.stringify(rows.filter((x) => String(x.chatId) !== "6265624643" && String(x.chatId) !== "8036360267"), replacer));
    console.log("\n--- non-reply entries (all chats) ---");
    console.log(JSON.stringify(r.filter((x) => !x.reply), replacer));
    return p.$disconnect();
  })
  .catch((e) => { console.error("ERR:" + e.message); return p.$disconnect(); });