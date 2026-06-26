import { IsString } from 'class-validator'

export class DeleteTicketDto {
  @IsString()
  reason: string
}
