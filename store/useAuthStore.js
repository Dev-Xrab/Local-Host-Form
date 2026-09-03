import { create } from 'zustand';

const useAuthStore = create((set) => ({
  // 1. Raw State
  role: "",
  isLogin: false,
  sessionID: "",
  isValidating: false,
  serverErrors: null,

  // 2. Grouped Actions (Cleaner to import and call in components)
  actions: {
    updateRole: (newRole) => set({ role: newRole || "" }),
    login: (sessionID, role) => set({ isLogin: true, sessionID: sessionID || "", role: role || "" }),
    logout: () => set({ isLogin: false, sessionID: "", role: "" }),
    updateSessionID: (newSessionID) => set({ sessionID: newSessionID || "" }),
    validateLogIn: async (userName, password)=> {
        set({isValidating:true, serverErrors:null})

        //Backend Logic Here
    },
  }
}));


export const useAuthActions = () => useAuthStore((state) => state.actions);

export default useAuthStore;
