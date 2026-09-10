import { PostType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  examBoardId?: string;

  @IsEnum(PostType)
  type!: PostType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  title!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase, alphanumeric, hyphen-separated (e.g. "dsssb-tgt-notification-2026")',
  })
  slug!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsOptional()
  @IsUrl()
  heroImage?: string;

  @IsOptional()
  @IsISO8601()
  publishedAt?: string;
}
