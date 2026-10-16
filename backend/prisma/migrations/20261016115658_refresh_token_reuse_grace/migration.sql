-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "grace_used_at" TIMESTAMPTZ(3);
