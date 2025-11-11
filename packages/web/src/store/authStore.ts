import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_ENDPOINTS } from '../config/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isRefreshing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User, token: string) => void;
  refreshAccessToken: () => Promise<string>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    set => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isRefreshing: false,

      login: async (email: string, password: string) => {
        const response = await fetch(API_ENDPOINTS.login, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Error al iniciar sesión');
        }

        const data = await response.json();
        set({
          user: data.user,
          token: data.accessToken || data.token, // Support both formats
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      register: async (name: string, email: string, password: string) => {
        const response = await fetch(API_ENDPOINTS.register, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name, email, password }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Error al registrar usuario');
        }

        const data = await response.json();
        set({
          user: data.user,
          token: data.accessToken || data.token,
          refreshToken: data.refreshToken,
          isAuthenticated: true,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      setUser: (user: User, token: string) => {
        set({ user, token, isAuthenticated: true });
      },

      refreshAccessToken: async (): Promise<string> => {
        const state = useAuthStore.getState();

        if (!state.refreshToken) {
          throw new Error('No refresh token available');
        }

        if (state.isRefreshing) {
          // Wait for ongoing refresh
          return new Promise<string>(resolve => {
            const checkInterval = setInterval(() => {
              const currentState = useAuthStore.getState();
              if (!currentState.isRefreshing) {
                clearInterval(checkInterval);
                resolve(currentState.token!);
              }
            }, 100);
          });
        }

        set({ isRefreshing: true });

        try {
          const response = await fetch(API_ENDPOINTS.refresh, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ refreshToken: state.refreshToken }),
          });

          if (!response.ok) {
            // Refresh token expired or invalid - logout
            set({
              user: null,
              token: null,
              refreshToken: null,
              isAuthenticated: false,
              isRefreshing: false,
            });
            throw new Error('Session expired. Please login again.');
          }

          const data = await response.json();
          set({
            token: data.accessToken,
            isRefreshing: false,
          });

          return data.accessToken as string;
        } catch (error) {
          set({ isRefreshing: false });
          throw error;
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
