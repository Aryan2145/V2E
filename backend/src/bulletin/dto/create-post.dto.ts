import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBulletinPostDto {
  @IsString()
  @MaxLength(300)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsArray()
  attachment_urls?: { name: string; url: string }[];
}
