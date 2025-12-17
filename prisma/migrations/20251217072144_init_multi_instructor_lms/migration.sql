/*
  Warnings:

  - You are about to drop the column `instructor_name` on the `live_lectures` table. All the data in the column will be lost.
  - You are about to drop the column `live_lecture_id` on the `time_table` table. All the data in the column will be lost.
  - Added the required column `instructor_id` to the `time_table` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "time_table" DROP CONSTRAINT "time_table_live_lecture_id_fkey";

-- AlterTable
ALTER TABLE "live_lectures" DROP COLUMN "instructor_name",
ADD COLUMN     "instructor_id" INTEGER,
ALTER COLUMN "status" SET DEFAULT 'live';

-- AlterTable
ALTER TABLE "time_table" DROP COLUMN "live_lecture_id",
ADD COLUMN     "instructor_id" INTEGER NOT NULL,
ADD COLUMN     "module_id" INTEGER;

-- AddForeignKey
ALTER TABLE "live_lectures" ADD CONSTRAINT "live_lectures_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_table" ADD CONSTRAINT "time_table_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_table" ADD CONSTRAINT "time_table_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "syllabus_modules"("module_id") ON DELETE SET NULL ON UPDATE CASCADE;
