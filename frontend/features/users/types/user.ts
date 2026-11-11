// Mirrors be UserResponseDto (user/dto/user-response.dto.ts).

export type UserLite = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
};
