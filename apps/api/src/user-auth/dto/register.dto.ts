import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  // A reasonable minimum, not a full password-policy check (character
  // classes, breach lists, etc.) — that's out of TAPS-5.1's scope.
  @IsString()
  @MinLength(8)
  @MaxLength(72) // bcrypt silently truncates/ignores input past 72 bytes
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}
