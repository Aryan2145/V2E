import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ProcessNodeStatus } from '@prisma/client';

export class RequestReviewDto {
  @IsOptional()
  @IsBoolean()
  cascade?: boolean; // also move every node inside this one
}

export class DecideStatusDto {
  @IsEnum(ProcessNodeStatus)
  status!: ProcessNodeStatus; // final = approve, draft = send back

  @IsOptional()
  @IsBoolean()
  cascade?: boolean;
}
