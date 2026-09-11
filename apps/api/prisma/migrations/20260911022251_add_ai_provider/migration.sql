-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('ANTHROPIC', 'OPENAI');

-- AlterTable
ALTER TABLE "quiz_questions" ADD COLUMN     "aiProvider" "AIProvider" NOT NULL DEFAULT 'ANTHROPIC';
