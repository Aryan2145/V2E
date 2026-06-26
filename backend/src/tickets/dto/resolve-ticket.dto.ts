import { IsString } from 'class-validator'

export class ResolveTicketDto {
  @IsString()
  resolution_note: string
}
