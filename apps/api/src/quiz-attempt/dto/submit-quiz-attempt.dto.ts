import { IsObject } from 'class-validator';

export class SubmitQuizAttemptDto {
  // Question id -> selected option index. Keys are dynamic (one per
  // question in the attempt), so class-validator can't shape-check this
  // beyond "is an object" — QuizAttemptService validates the actual
  // per-question values (must be an integer within the question's options
  // range) once it has the attempt's real question list to check against.
  @IsObject()
  answers!: Record<string, number>;
}
