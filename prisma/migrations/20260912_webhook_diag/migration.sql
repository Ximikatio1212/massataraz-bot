-- CreateTable
CREATE TABLE "WebhookDiag" (
    "id" SERIAL NOT NULL,
    "updateId" BIGINT NOT NULL,
    "chatId" BIGINT,
    "fromId" BIGINT,
    "reply" BOOLEAN NOT NULL DEFAULT false,
    "replyMethod" TEXT,
    "noReplyReason" TEXT NOT NULL DEFAULT 'none',
    "diag" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDiag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookDiag_updateId_key" ON "WebhookDiag"("updateId");

-- CreateIndex
CREATE INDEX "WebhookDiag_createdAt_idx" ON "WebhookDiag"("createdAt");