const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  try {
    const u = await p.user.findFirst({ where: { telegramId: BigInt(8036360267) } });
    if (!u) { console.log('user not found'); return; }
    await p.userState.upsert({
      where: { userId: u.id },
      create: { userId: u.id, state: 'NONE', payload: undefined, canvasChatId: null, canvasMessageId: null },
      update: { state: 'NONE', payload: undefined, canvasChatId: null, canvasMessageId: null },
    });
    console.log('state reset for', u.id);
  } catch (e) { console.error(e.message); }
  finally { await p.$disconnect(); }
})();