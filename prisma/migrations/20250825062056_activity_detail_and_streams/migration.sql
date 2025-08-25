-- AlterTable
ALTER TABLE "public"."Activity" ADD COLUMN     "avg_cadence" DOUBLE PRECISION,
ADD COLUMN     "avg_hr" DOUBLE PRECISION,
ADD COLUMN     "avg_speed" DOUBLE PRECISION,
ADD COLUMN     "avg_watts" DOUBLE PRECISION,
ADD COLUMN     "calories" DOUBLE PRECISION,
ADD COLUMN     "device_name" TEXT,
ADD COLUMN     "has_streams" BOOLEAN DEFAULT false,
ADD COLUMN     "map_polyline" TEXT,
ADD COLUMN     "max_hr" DOUBLE PRECISION,
ADD COLUMN     "raw_detail" JSONB;

-- CreateTable
CREATE TABLE "public"."ActivityStream" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "time" JSONB,
    "heartrate" JSONB,
    "velocity_smooth" JSONB,
    "altitude" JSONB,
    "cadence" JSONB,
    "watts" JSONB,
    "grade_smooth" JSONB,
    "latlng" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityStream_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityStream_activityId_key" ON "public"."ActivityStream"("activityId");

-- AddForeignKey
ALTER TABLE "public"."ActivityStream" ADD CONSTRAINT "ActivityStream_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "public"."Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
