-- AlterEnum
ALTER TYPE "ConversationState" ADD VALUE 'WAITING_ORDER_POSTAL';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "postalCode" TEXT;