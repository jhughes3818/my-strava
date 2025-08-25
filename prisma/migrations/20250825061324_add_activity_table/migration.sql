/*
  Warnings:

  - You are about to drop the column `distance` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `elapsed_time` on the `Activity` table. All the data in the column will be lost.
  - You are about to drop the column `moving_time` on the `Activity` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Activity` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Activity" DROP COLUMN "distance",
DROP COLUMN "elapsed_time",
DROP COLUMN "moving_time",
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "distance_m" DOUBLE PRECISION,
ADD COLUMN     "elapsed_s" INTEGER,
ADD COLUMN     "is_commute" BOOLEAN,
ADD COLUMN     "is_trainer" BOOLEAN,
ADD COLUMN     "moving_s" INTEGER,
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "total_elev_m" DOUBLE PRECISION,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "Activity_userId_idx" ON "public"."Activity"("userId");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "public"."Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_start_date_idx" ON "public"."Activity"("start_date");
