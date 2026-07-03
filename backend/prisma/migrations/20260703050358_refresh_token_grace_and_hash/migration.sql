-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refresh_token_prev" TEXT,
ADD COLUMN     "refresh_token_prev_exp" TIMESTAMP(3);
