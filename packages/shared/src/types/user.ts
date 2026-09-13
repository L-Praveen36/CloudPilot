export interface UserDto {
  id: string;
  githubId: string;
  username: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CreateUserDto {
  githubId: string;
  username: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}
