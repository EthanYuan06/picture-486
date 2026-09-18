export type UserInfo = {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  roles?: string[];
};

export type AuthState = {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  csrfToken: string | null;
  expiresAt: number | null;
};

