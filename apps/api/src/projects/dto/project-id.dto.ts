import { IsUUID } from 'class-validator';

export class ProjectIdDto {
  @IsUUID('4', { message: 'Invalid project ID format. Must be a valid UUID v4.' })
  id: string;
}
