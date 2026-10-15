const KEY = 'mini-marketplace:has-session';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const sessionHint = {
  has(): boolean {
    try {
      return storage()?.getItem(KEY) === '1';
    } catch {
      return true;
    }
  },

  set(): void {
    try {
      storage()?.setItem(KEY, '1');
    } catch {
      return;
    }
  },

  clear(): void {
    try {
      storage()?.removeItem(KEY);
    } catch {
      return;
    }
  },
};
