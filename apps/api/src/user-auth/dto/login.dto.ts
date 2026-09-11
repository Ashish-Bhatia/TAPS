import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email!: string;

  // Just presence, matching apps/api/src/auth/dto/login.dto.ts's pattern —
  // deliberately not re-enforcing RegisterDto's 8-char minimum here: doing
  // so would let an attacker distinguish "this email exists but the
  // password is too short to be valid" from a real wrong-password case via
  // a different error, undermining the enumeration-safety UserAuthService
  // is responsible for. Real length validation already happened at
  // registration time.
  @IsString()
  @MinLength(1)
  password!: string;
}
