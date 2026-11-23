/*
  Warnings:

  - You are about to drop the column `timeSlots` on the `Schedule` table. All existing values are discarded; slots now live in the new `TimeSlot` table.
  - You are about to drop the column `timeSlot` on the `Booking` table, replaced by `startTime` and `endTime`. Existing bookings are discarded since they predate the capacity-aware time slot model.

*/
-- AlterTable
ALTER TABLE "Schedule" DROP COLUMN "timeSlots";

-- CreateTable
CREATE TABLE "TimeSlot" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "maxSlots" INTEGER NOT NULL DEFAULT 1,
    "bookedSlots" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimeSlot_scheduleId_startTime_endTime_key" ON "TimeSlot"("scheduleId", "startTime", "endTime");

-- AddForeignKey
ALTER TABLE "TimeSlot" ADD CONSTRAINT "TimeSlot_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Discard bookings made under the old single-string timeSlot shape (approved: safe to wipe)
DELETE FROM "Booking";

-- DropIndex
DROP INDEX "Booking_userId_date_timeSlot_key";

-- AlterTable
ALTER TABLE "Booking" DROP COLUMN "timeSlot",
ADD COLUMN     "startTime" TEXT NOT NULL,
ADD COLUMN     "endTime" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Booking_userId_date_startTime_endTime_idx" ON "Booking"("userId", "date", "startTime", "endTime");
