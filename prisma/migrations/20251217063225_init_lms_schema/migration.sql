/*
  Warnings:

  - The `content_type` column on the `lessons` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('video', 'live', 'quiz', 'assignment', 'pdf');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('present', 'absent', 'late', 'excused');

-- AlterTable
ALTER TABLE "lessons" ALTER COLUMN "content_url" DROP NOT NULL,
DROP COLUMN "content_type",
ADD COLUMN     "content_type" "ContentType" NOT NULL DEFAULT 'video';

-- CreateTable
CREATE TABLE "live_lectures" (
    "live_lecture_id" SERIAL NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "room_id" VARCHAR(100) NOT NULL,
    "meeting_url" VARCHAR(500),
    "start_time" TIMESTAMP(3) NOT NULL,
    "end_time" TIMESTAMP(3) NOT NULL,
    "instructor_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',

    CONSTRAINT "live_lectures_pkey" PRIMARY KEY ("live_lecture_id")
);

-- CreateTable
CREATE TABLE "time_table" (
    "schedule_id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "day_of_week" VARCHAR(15) NOT NULL,
    "start_time" VARCHAR(10) NOT NULL,
    "end_time" VARCHAR(10) NOT NULL,
    "live_lecture_id" INTEGER,

    CONSTRAINT "time_table_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateTable
CREATE TABLE "attendance" (
    "attendance_id" SERIAL NOT NULL,
    "live_lecture_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'absent',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("attendance_id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "quiz_id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("quiz_id")
);

-- CreateTable
CREATE TABLE "questions" (
    "question_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "question_type" TEXT NOT NULL DEFAULT 'multiple_choice',

    CONSTRAINT "questions_pkey" PRIMARY KEY ("question_id")
);

-- CreateTable
CREATE TABLE "question_choices" (
    "choice_id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "choice_text" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "question_choices_pkey" PRIMARY KEY ("choice_id")
);

-- CreateTable
CREATE TABLE "quiz_submissions" (
    "submission_id" SERIAL NOT NULL,
    "quiz_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_submissions_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "assignments" (
    "assignment_id" SERIAL NOT NULL,
    "module_id" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "due_date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("assignment_id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "submission_id" SERIAL NOT NULL,
    "assignment_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "submission_url" VARCHAR(500) NOT NULL,
    "grade" INTEGER,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("submission_id")
);

-- CreateTable
CREATE TABLE "scholarships" (
    "scholarship_id" SERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "eligibility_criteria" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "deadline" TIMESTAMP(3),

    CONSTRAINT "scholarships_pkey" PRIMARY KEY ("scholarship_id")
);

-- CreateTable
CREATE TABLE "scholarship_applications" (
    "application_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "scholarship_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scholarship_applications_pkey" PRIMARY KEY ("application_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "live_lectures_lesson_id_key" ON "live_lectures"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_live_lecture_id_user_id_key" ON "attendance"("live_lecture_id", "user_id");

-- AddForeignKey
ALTER TABLE "live_lectures" ADD CONSTRAINT "live_lectures_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("lesson_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_table" ADD CONSTRAINT "time_table_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_table" ADD CONSTRAINT "time_table_live_lecture_id_fkey" FOREIGN KEY ("live_lecture_id") REFERENCES "live_lectures"("live_lecture_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_live_lecture_id_fkey" FOREIGN KEY ("live_lecture_id") REFERENCES "live_lectures"("live_lecture_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "syllabus_modules"("module_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("quiz_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_choices" ADD CONSTRAINT "question_choices_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("question_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_quiz_id_fkey" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("quiz_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_submissions" ADD CONSTRAINT "quiz_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "syllabus_modules"("module_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("assignment_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scholarship_applications" ADD CONSTRAINT "scholarship_applications_scholarship_id_fkey" FOREIGN KEY ("scholarship_id") REFERENCES "scholarships"("scholarship_id") ON DELETE RESTRICT ON UPDATE CASCADE;
