import { IsString } from 'class-validator';

export class CreateBulletinCommentDto {
  @IsString()
  body: string;
}
