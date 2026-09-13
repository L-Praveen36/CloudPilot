import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RepositoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be greater than or equal to 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'perPage must be an integer' })
  @Min(1, { message: 'perPage must be greater than or equal to 1' })
  @Max(100, { message: 'perPage cannot exceed 100' })
  perPage?: number = 30;
}
