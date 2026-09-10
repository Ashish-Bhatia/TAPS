-- CreateEnum
CREATE TYPE "ExamBoardType" AS ENUM ('TEACHING', 'TET');

-- CreateEnum
CREATE TYPE "PostType" AS ENUM ('NOTIFICATION', 'ARTICLE');

-- CreateTable
CREATE TABLE "exam_boards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ExamBoardType" NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exam_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "examBoardId" TEXT,
    "type" "PostType" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "heroImage" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabuses" (
    "id" TEXT NOT NULL,
    "examBoardId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topics" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "past_papers" (
    "id" TEXT NOT NULL,
    "examBoardId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "past_papers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_materials" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "posts_slug_key" ON "posts"("slug");

-- CreateIndex
CREATE INDEX "posts_examBoardId_idx" ON "posts"("examBoardId");

-- CreateIndex
CREATE INDEX "syllabuses_examBoardId_idx" ON "syllabuses"("examBoardId");

-- CreateIndex
CREATE INDEX "syllabuses_subject_idx" ON "syllabuses"("subject");

-- CreateIndex
CREATE INDEX "past_papers_examBoardId_idx" ON "past_papers"("examBoardId");

-- CreateIndex
CREATE INDEX "past_papers_subject_idx" ON "past_papers"("subject");

-- CreateIndex
CREATE INDEX "past_papers_year_idx" ON "past_papers"("year");

-- CreateIndex
CREATE INDEX "past_papers_examBoardId_subject_year_idx" ON "past_papers"("examBoardId", "subject", "year");

-- CreateIndex
CREATE INDEX "study_materials_subject_idx" ON "study_materials"("subject");

-- CreateIndex
CREATE INDEX "books_subject_idx" ON "books"("subject");

-- CreateIndex
CREATE INDEX "books_class_idx" ON "books"("class");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "exam_boards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabuses" ADD CONSTRAINT "syllabuses_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "exam_boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "past_papers" ADD CONSTRAINT "past_papers_examBoardId_fkey" FOREIGN KEY ("examBoardId") REFERENCES "exam_boards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
