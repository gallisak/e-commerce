import { createContext } from 'react';
import type { SessionStatus } from '@/lib/api/session';
import type { User } from '@/lib/api/types';
import type { LoginInput, RegisterInput } from './api';

export interface AuthContextValue {
  status: SessionStatus;
  user: User | null;
  isAdmin: boolean;
  login(input: LoginInput): Promise<User>;
  register(input: RegisterInput): Promise<User>;
  logout(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
