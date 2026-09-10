import { ExamBoardType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateExamBoardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @IsEnum(ExamBoardType)
  type!: ExamBoardType;

  @IsString()
  @IsNotEmpty()
  description!: string;
}
