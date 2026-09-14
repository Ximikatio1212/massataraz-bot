-- AlterEnum
ALTER TYPE "ConversationState" ADD VALUE 'WAITING_ORDER_TRACK';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "trackNumber" TEXT;

-- AlterTable (профиль доставки для Telegram Mini App)
ALTER TABLE "User" ADD COLUMN "profile" JSONB;