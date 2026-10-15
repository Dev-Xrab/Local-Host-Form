import { create } from 'zustand';
import { authApi } from '../src/features/auth/services/authApi';
import { getMode, getServerUrl, isNativeClient, loadConnection, setAuthToken, setMode, setServerUrl, verifyServer } from '../lib/http';
import { startPhoneHost, stopPhoneHost } from '../lib/phoneServer';

// Web only: the session is a cookie shared by every tab, but each tab keeps its own copy of "am I
// logged in" in this store. Without this, logging out in one tab leaves the others looking signed in
// until some request happens to fail. Tabs tell each other through a localStorage event (the
// `storage` event fires in every *other* tab), and a tab that regains focus re-checks the cookie.
const AUTH_EVENT_KEY = 'shf_auth_event';
const canSync = !isNativeClient && typeof window !== 'undefined' && typeof localStorage !== 'undefined';

function announce(type) {
  if (!canSync) return;
  try {
    localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ type, at: Date.now() }));
  } catch {
    // private mode: the focus re-check below still catches it
  }
}

const useAuthStore = create((set) => ({
  // 1. Raw State
  isLogin: false,
  isChecking: true, // true until the initial /api/auth/me check resolves
  isSubmitting: false,
  needsServer: false, // native app only: no server address saved yet
  serverUrl: null,
  hostingOnPhone: false, // native app only: this phone runs its own server
  needsSetup: false, // true when no one has created an account on this server yet
  hasRecoveryQuestion: false,
  error: null,

  // 2. Grouped Actions (Cleaner to import and call in components)
  actions: {
    checkSession: async () => {
      if (isNativeClient) {
        await loadConnection();
        // Hosting on this phone: bring the on-device server up first (it listens on loopback for the app itself).
        if (getMode() === 'host') {
          try {
            await startPhoneHost();
          } catch (err) {
            set({ needsServer: true, serverUrl: null, isLogin: false, isChecking: false, error: err.message });
            return;
          }
          set({ hostingOnPhone: true });
        }
        if (!getServerUrl()) {
          set({ needsServer: true, serverUrl: null, isLogin: false, isChecking: false });
          return;
        }
        set({ needsServer: false, serverUrl: getServerUrl() });
      }
      try {
        const { authenticated, needsSetup, hasRecoveryQuestion } = await authApi.me();
        set({
          isLogin: authenticated,
          needsSetup: !!needsSetup,
          hasRecoveryQuestion: !!hasRecoveryQuestion,
          isChecking: false,
        });
      } catch {
        set({ isLogin: false, isChecking: false });
      }
    },

    // Native app only: validates and saves the address of the host's server.
    connectServer: async (input) => {
      set({ isSubmitting: true, error: null });
      try {
        const url = await verifyServer(input);
        await setServerUrl(url);
        await setMode('remote');
        set({ serverUrl: url, needsServer: false, isChecking: true, isSubmitting: false });
        await useAuthStore.getState().actions.checkSession();
        return true;
      } catch (err) {
        set({ isSubmitting: false, error: err.message });
        return false;
      }
    },

    // Native app only: this phone becomes the host. Starts the on-device server and remembers the choice.
    hostOnPhone: async () => {
      set({ isSubmitting: true, error: null });
      try {
        await startPhoneHost();
        set({ isSubmitting: false, hostingOnPhone: true, needsServer: false, isChecking: true });
        await useAuthStore.getState().actions.checkSession();
        return true;
      } catch (err) {
        set({ isSubmitting: false, error: err.message });
        return false;
      }
    },

    changeServer: async () => {
      await stopPhoneHost();
      await setAuthToken(null);
      await setServerUrl(null);
      await setMode(null);
      set({ isLogin: false, needsServer: true, serverUrl: null, hostingOnPhone: false, error: null });
    },

    setup: async (password) => {
      set({ isSubmitting: true, error: null });
      try {
        const { hasRecoveryQuestion, token } = await authApi.setup(password);
        if (isNativeClient) await setAuthToken(token ?? null);
        set({
          isLogin: true,
          needsSetup: false,
          hasRecoveryQuestion: !!hasRecoveryQuestion,
          isSubmitting: false,
        });
        return true;
      } catch (err) {
        set({ isSubmitting: false, error: err.message });
        return false;
      }
    },

    login: async (password) => {
      set({ isSubmitting: true, error: null });
      try {
        const { hasRecoveryQuestion, token } = await authApi.login(password);
        if (isNativeClient) await setAuthToken(token ?? null);
        set({
          isLogin: true,
          hasRecoveryQuestion: !!hasRecoveryQuestion,
          isSubmitting: false,
        });
        announce('login');
        return true;
      } catch (err) {
        set({ isSubmitting: false, error: err.message });
        return false;
      }
    },

    logout: async () => {
      try {
        await authApi.logout();
      } finally {
        await setAuthToken(null);
        set({ isLogin: false });
        announce('logout');
      }
    },

    recoveryQuestionSet: () => set({ hasRecoveryQuestion: true }),
  },
}));

export const useAuthActions = () => useAuthStore((state) => state.actions);

export default useAuthStore;

if (canSync) {
  const recheck = async () => {
    const { isLogin, isChecking } = useAuthStore.getState();
    if (isChecking) return;
    try {
      const { authenticated, needsSetup, hasRecoveryQuestion } = await authApi.me();
      if (authenticated !== isLogin) useAuthStore.setState({ isLogin: authenticated, needsSetup: !!needsSetup, hasRecoveryQuestion: !!hasRecoveryQuestion });
    } catch {
      // server unreachable: leave the current state alone
    }
  };

  window.addEventListener('storage', (e) => {
    if (e.key !== AUTH_EVENT_KEY || !e.newValue) return;
    let type;
    try { type = JSON.parse(e.newValue).type; } catch { return; }
    if (type === 'logout') useAuthStore.setState({ isLogin: false });
    else if (type === 'login') recheck();
  });
  window.addEventListener('focus', recheck);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recheck(); });
}
