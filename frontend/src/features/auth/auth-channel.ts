export type AuthBroadcast = { type: 'signed-in' } | { type: 'signed-out' };

const CHANNEL_NAME = 'mini-marketplace:auth';

export function createAuthChannel(onMessage: (message: AuthBroadcast) => void) {
  if (typeof BroadcastChannel === 'undefined') {
    return { post: () => undefined, close: () => undefined };
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<AuthBroadcast>) => onMessage(event.data);
  return {
    post: (message: AuthBroadcast) => channel.postMessage(message),
    close: () => channel.close(),
  };
}
