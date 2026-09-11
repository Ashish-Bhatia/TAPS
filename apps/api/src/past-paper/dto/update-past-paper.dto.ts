import { PartialType } from '@nestjs/mapped-types';
import { CreatePastPaperDto } from './create-past-paper.dto.js';

export class UpdatePastPaperDto extends PartialType(CreatePastPaperDto) {}
