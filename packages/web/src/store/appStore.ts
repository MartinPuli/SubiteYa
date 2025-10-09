import { create } from 'zustand';
import { API_BASE_URL } from '../config/api';

interface TikTokConnection {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isDefault: boolean;
}

interface PublishJob {
  id: string;
  caption: string;
  state: string;
  tiktokConnection: {
    displayName: string;
  };
  createdAt: string;
}

interface AppState {
  connections: TikTokConnection[];
  jobs: PublishJob[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setConnections: (connections: TikTokConnection[]) => void;
  setJobs: (jobs: PublishJob[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // API methods
  fetchConnections: (token: string) => Promise<void>;
  fetchJobs: (token: string) => Promise<void>;
  deleteConnection: (token: string, connectionId: string) => Promise<void>;
  setDefaultConnection: (token: string, connectionId: string) => Promise<void>;
  createMockConnection: (token: string, displayName: string) => Promise<void>;
}

const API_URL = API_BASE_URL;

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  jobs: [],
  isLoading: false,
  error: null,

  setConnections: connections => set({ connections }),
  setJobs: jobs => set({ jobs }),
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),

  fetchConnections: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/connections`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Error al obtener conexiones');
      }

      const data = await response.json();
      set({ connections: data.connections, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  fetchJobs: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Fetching jobs from:', `${API_URL}/publish/jobs`);
      const response = await fetch(`${API_URL}/publish/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });

      console.log('Jobs response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Jobs fetch error:', response.status, errorText);
        throw new Error('Error al obtener trabajos');
      }

      const data = await response.json();
      console.log('Jobs fetched:', data.jobs?.length || 0, 'jobs');
      set({ jobs: data.jobs, isLoading: false });
    } catch (error) {
      console.error('Fetch jobs exception:', error);
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteConnection: async (token: string, connectionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/connections/${connectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al eliminar conexión');
      }

      // Refresh connections
      await get().fetchConnections(token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  setDefaultConnection: async (token: string, connectionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(
        `${API_URL}/connections/${connectionId}/set-default`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        throw new Error('Error al establecer conexión predeterminada');
      }

      // Refresh connections
      await get().fetchConnections(token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  createMockConnection: async (token: string, displayName: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/connections/mock`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName }),
      });

      if (!response.ok) {
        throw new Error('Error al crear conexión mock');
      }

      // Refresh connections
      await get().fetchConnections(token);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },
}));
