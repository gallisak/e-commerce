import type { AuthContextValue } from '@/features/auth/auth-context';
import type { User } from '@/lib/api/types';
import type { MockHandler } from './http';

export interface StoryParameters {
  user?: User | null;
  queryData?: [readonly unknown[], unknown][];
  api?: MockHandler;
  route?: string;
  auth?: Partial<AuthContextValue>;
}

export const storyParameters = (parameters: StoryParameters) => parameters;
