import { IsBoolean, IsOptional, IsString } from 'class-validator'

export class UpdateTicketDto {
  @IsOptional()
  @IsString()
  title?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  ticket_type_id?: string

  @IsOptional()
  @IsString()
  category_id?: string

  @IsOptional()
  @IsString()
  priority_id?: string

  @IsOptional()
  @IsBoolean()
  proof_required?: boolean
}
