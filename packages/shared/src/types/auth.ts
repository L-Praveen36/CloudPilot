import { UserDto } from './user';

export interface CurrentUserResponse {
  user: UserDto;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface GitHubUserProfile {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}
