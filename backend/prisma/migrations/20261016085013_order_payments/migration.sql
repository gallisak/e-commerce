-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "payment_id" TEXT,
ADD COLUMN     "refunded_at" TIMESTAMPTZ(3);
