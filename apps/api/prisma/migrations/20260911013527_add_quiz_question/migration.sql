-- CreateEnum
CREATE TYPE "QuizDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "quiz_questions" (
    "id" TEXT NOT NULL,
    "pastPaperId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "difficulty" "QuizDifficulty" NOT NULL,
    "questionText" TEXT NOT NULL,
    "options" TEXT[],
    "correctOption" INTEGER NOT NULL,
    "explanation" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT true,
    "reviewedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quiz_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quiz_questions_pastPaperId_idx" ON "quiz_questions"("pastPaperId");

-- CreateIndex
CREATE INDEX "quiz_questions_subject_idx" ON "quiz_questions"("subject");

-- CreateIndex
CREATE INDEX "quiz_questions_topic_idx" ON "quiz_questions"("topic");

-- AddForeignKey
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_pastPaperId_fkey" FOREIGN KEY ("pastPaperId") REFERENCES "past_papers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
