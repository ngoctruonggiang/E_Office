-- CreateEnum
CREATE TYPE "RequestDocSection" AS ENUM ('MAIN', 'SECONDARY');

-- AlterTable
ALTER TABLE "RequestDocument" ADD COLUMN     "section" "RequestDocSection" NOT NULL DEFAULT 'SECONDARY';
