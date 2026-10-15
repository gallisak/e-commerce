import type { User } from './types';

export type SessionStatus = 'pending' | 'authenticated' | 'anonymous';

export interface SessionState {
  status: SessionStatus;
  user: User | null;
  accessToken: string | null;
}

type Listener = () => void;

const INITIAL_STATE: SessionState = { status: 'pending', user: null, accessToken: null };

let state: SessionState = INITIAL_STATE;
const listeners = new Set<Listener>();

function emit(next: SessionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

export const session = {
  getState(): SessionState {
    return state;
  },

  getAccessToken(): string | null {
    return state.accessToken;
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  signIn(user: User, accessToken: string): void {
    emit({ status: 'authenticated', user, accessToken });
  },

  signOut(): void {
    emit({ status: 'anonymous', user: null, accessToken: null });
  },

  reset(): void {
    emit(INITIAL_STATE);
  },
};
