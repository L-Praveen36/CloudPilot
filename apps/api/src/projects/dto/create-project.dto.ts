import { IsInt, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProjectDto {
  @Type(() => Number)
  @IsInt({ message: 'githubRepositoryId must be an integer' })
  @Min(1, { message: 'githubRepositoryId must be greater than or equal to 1' })
  githubRepositoryId: number;

  @IsString()
  @Matches(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/, {
    message: 'Invalid repository owner format. Must be a valid GitHub user or organization name.',
  })
  repositoryOwner: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Invalid repository name format. Must be a valid GitHub repository name.',
  })
  repositoryName: string;
}
