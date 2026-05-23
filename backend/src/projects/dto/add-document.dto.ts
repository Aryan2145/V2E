import { IsString, IsOptional } from 'class-validator';

export class AddDocumentDto {
  @IsString()
  name: string;

  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  type?: string;
}
