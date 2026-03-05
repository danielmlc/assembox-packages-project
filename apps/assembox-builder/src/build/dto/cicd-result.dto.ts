import { IsNotEmpty, IsString } from 'class-validator';

export class CicdResultDto {
  @IsNotEmpty()
  @IsString()
  moduleGroupCode: string;

  @IsNotEmpty()
  @IsString()
  status: 'success' | 'failure';
}
