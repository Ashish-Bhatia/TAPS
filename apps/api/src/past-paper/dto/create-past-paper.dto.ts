import { IsInt, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreatePastPaperDto {
  @IsString()
  @IsNotEmpty()
  examBoardId!: string;

  @IsString()
  @IsNotEmpty()
  subject!: string;

  @IsInt()
  year!: number;

  @IsUrl()
  fileUrl!: string;
}
