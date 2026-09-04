import { create } from 'zustand';
import { authApi } from '../src/features/auth/services/authApi';

const useAuthStore = create((set) => ({
  // 1. Raw State
  isLogin: false,
  isChecking: true, // true until the initial /api/auth/me check resolves
  isSubmitting: false,
  isDefaultPassword: false,
  hasRecoveryQuestion: false,
  error: null,

  // 2. Grouped Actions (Cleaner to import and call in components)
  actions: {
    checkSession: async () => {
      try {
        const { authenticated, isDefaultPassword, hasRecoveryQuestion } = await authApi.me();
        set({
          isLogin: authenticated,
          isDefaultPassword: !!isDefaultPassword,
          hasRecoveryQuestion: !!hasRecoveryQuestion,
          isChecking: false,
        });
      } catch {
        set({ isLogin: false, isChecking: false });
      }
    },

    login: async (password) => {
      set({ isSubmitting: true, error: null });
      try {
        const { isDefaultPassword, hasRecoveryQuestion } = await authApi.login(password);
        set({
          isLogin: true,
          isDefaultPassword: !!isDefaultPassword,
          hasRecoveryQuestion: !!hasRecoveryQuestion,
          isSubmitting: false,
        });
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
        set({ isLogin: false });
      }
    },

    passwordChanged: () => set({ isDefaultPassword: false }),
    recoveryQuestionSet: () => set({ hasRecoveryQuestion: true }),
  },
}));

export const useAuthActions = () => useAuthStore((state) => state.actions);

export default useAuthStore;
