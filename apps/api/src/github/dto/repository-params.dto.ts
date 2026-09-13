import { IsString, Matches } from 'class-validator';

export class RepositoryParamsDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/, {
    message: 'Invalid repository owner format. Must be a valid GitHub user or organization name.',
  })
  owner: string;

  @IsString()
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message: 'Invalid repository name format. Must be a valid GitHub repository name.',
  })
  repo: string;
}
