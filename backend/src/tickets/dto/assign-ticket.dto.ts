import { IsString } from 'class-validator'

export class AssignTicketDto {
  @IsString()
  assigned_to_user_id: string
}
