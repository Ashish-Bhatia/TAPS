import { IsNotEmpty, IsString } from 'class-validator';

export class StartQuizAttemptDto {
  @IsString()
  @IsNotEmpty()
  examBoardId!: string;
}
