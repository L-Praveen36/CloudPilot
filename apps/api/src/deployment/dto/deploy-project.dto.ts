import { IsOptional, IsString } from 'class-validator';

export class DeployProjectDto {
  @IsOptional()
  @IsString({ message: 'environmentId must be a string' })
  environmentId?: string;
}
