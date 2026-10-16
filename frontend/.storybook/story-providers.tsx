import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useEffect, useState } from 'react';
import { MemoryRouter } from 'react-router';
import { Toaster } from 'sonner';
import { AuthContext, type AuthContextValue } from '@/features/auth/auth-context';
import { errorBody, type MockHandler, mockApi } from '@/test/http';
import type { StoryParameters } from '@/test/storybook';

const offline: MockHandler = () => ({
  status: 503,
  data: errorBody(503, 'Storybook has no backend'),
});

function MockedApi({ handler, children }: { handler: MockHandler; children: ReactNode }) {
  const [mock] = useState(() => mockApi(handler));
  useEffect(() => mock.restore, [mock]);
  return children;
}

function createStoryClient(queryData: StoryParameters['queryData'] = []) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
  for (const [key, data] of queryData) client.setQueryData(key, data);
  return client;
}

export function StoryProviders({
  parameters,
  children,
}: {
  parameters: StoryParameters;
  children: ReactNode;
}) {
  const { user = null, queryData, api = offline, route = '/', auth } = parameters;
  const [client] = useState(() => createStoryClient(queryData));

  const value: AuthContextValue = {
    status: user ? 'authenticated' : 'anonymous',
    user,
    isAdmin: user?.role === 'ADMIN',
    login: async () => {
      throw new Error('Not available in Storybook');
    },
    register: async () => {
      throw new Error('Not available in Storybook');
    },
    logout: async () => undefined,
    ...auth,
  };

  return (
    <MockedApi handler={api}>
      <QueryClientProvider client={client}>
        <AuthContext value={value}>
          <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
          <Toaster position="bottom-right" richColors closeButton />
        </AuthContext>
      </QueryClientProvider>
    </MockedApi>
  );
}

export function ThemeFrame({ dark, children }: { dark: boolean; children: ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);
  return <div className="min-h-screen bg-background p-4 text-foreground">{children}</div>;
}
