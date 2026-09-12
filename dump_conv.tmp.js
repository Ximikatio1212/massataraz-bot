const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const u = await p.user.findFirst({ where: { telegramId: BigInt(8036360267) } });
    if (!u) { console.log('user not found'); return; }
    const arr = (u.aiConversation || []).map((m, i) => ({ i, role: m.role, tool_calls: m.tool_calls, content: (m.content || '').toString().slice(0, 120) }));
    console.log(JSON.stringify(arr, null, 1));
  } catch (e) { console.error(e.message); }
  finally { await p.$disconnect(); }
})();