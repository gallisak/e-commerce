import { useQueryClient } from '@tanstack/react-query';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { refreshSession } from '@/lib/api/client';
import { session } from '@/lib/api/session';
import { sessionHint } from '@/lib/api/session-hint';
import type { AuthResponse } from '@/lib/api/types';
import { authApi, type LoginInput, type RegisterInput } from './api';
import { type AuthBroadcast, createAuthChannel } from './auth-channel';
import { AuthContext, type AuthContextValue } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(session.subscribe, session.getState);
  const channel = useRef<ReturnType<typeof createAuthChannel> | null>(null);

  useEffect(() => {
    const handle = (message: AuthBroadcast) => {
      queryClient.clear();
      if (message.type === 'signed-out') session.signOut();
      else void refreshSession().catch(() => session.signOut());
    };
    channel.current = createAuthChannel(handle);
    return () => channel.current?.close();
  }, [queryClient]);

  useEffect(() => {
    if (session.getState().status !== 'pending') return;
    if (!sessionHint.has()) {
      session.signOut();
      return;
    }
    refreshSession().catch(() => session.signOut());
  }, []);

  const startSession = useCallback(
    ({ user, accessToken }: AuthResponse) => {
      queryClient.clear();
      session.signIn(user, accessToken);
      sessionHint.set();
      channel.current?.post({ type: 'signed-in' });
      return user;
    },
    [queryClient],
  );

  const login = useCallback(
    async (input: LoginInput) => startSession(await authApi.login(input)),
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => startSession(await authApi.register(input)),
    [startSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      sessionHint.clear();
      session.signOut();
      queryClient.clear();
      channel.current?.post({ type: 'signed-out' });
    }
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      user: state.user,
      isAdmin: state.user?.role === 'ADMIN',
      login,
      register,
      logout,
    }),
    [state, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
