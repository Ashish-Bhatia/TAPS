import { PartialType } from '@nestjs/mapped-types';
import { CreateExamBoardDto } from './create-exam-board.dto.js';

export class UpdateExamBoardDto extends PartialType(CreateExamBoardDto) {}
