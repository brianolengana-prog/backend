-- DropIndex
DROP INDEX "public"."contacts_jobId_idx";

-- DropIndex
DROP INDEX "public"."contacts_name_idx";

-- DropIndex
DROP INDEX "public"."contacts_role_idx";

-- DropIndex
DROP INDEX "public"."contacts_userId_createdAt_idx";

-- DropIndex
DROP INDEX "public"."contacts_userId_idx";

-- DropIndex
DROP INDEX "public"."contacts_userId_jobId_idx";

-- DropIndex
DROP INDEX "public"."contacts_userId_role_idx";

-- AlterTable
ALTER TABLE "public"."users" ADD COLUMN     "stripe_customer_id" TEXT;
