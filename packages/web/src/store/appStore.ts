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
    avatarUrl?: string | null;
  };
  createdAt: string;
  editedUrl?: string | null;
  status?: string;
  videoAsset?: {
    originalFilename?: string | null;
    sizeBytes?: number | null;
  } | null;
  jobType?: 'publish' | 'video';
}

interface AppState {
  connections: TikTokConnection[];
  jobs: PublishJob[];
  isLoading: boolean;
  error: string | null;
  lastFetchConnections: number | null;
  lastFetchJobs: number | null;

  // Actions
  setConnections: (connections: TikTokConnection[]) => void;
  setJobs: (jobs: PublishJob[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // API methods
  fetchConnections: (token: string, forceRefresh?: boolean) => Promise<void>;
  fetchJobs: (token: string, forceRefresh?: boolean) => Promise<void>;
  deleteConnection: (token: string, connectionId: string) => Promise<void>;
  setDefaultConnection: (token: string, connectionId: string) => Promise<void>;
  createMockConnection: (token: string, displayName: string) => Promise<void>;
  deleteVideo: (token: string, videoId: string) => Promise<void>;
  deletePublishJob: (token: string, jobId: string) => Promise<void>;
}

const API_URL = API_BASE_URL;
const CACHE_DURATION = 30000; // 30 segundos

export const useAppStore = create<AppState>((set, get) => ({
  connections: [],
  jobs: [],
  isLoading: false,
  error: null,
  lastFetchConnections: null,
  lastFetchJobs: null,

  setConnections: connections => set({ connections }),
  setJobs: jobs => set({ jobs }),
  setLoading: isLoading => set({ isLoading }),
  setError: error => set({ error }),

  fetchConnections: async (token: string, forceRefresh = false) => {
    const state = get();
    const now = Date.now();

    // Si ya tenemos datos y no es force refresh, verificar cache
    if (
      !forceRefresh &&
      state.connections.length > 0 &&
      state.lastFetchConnections
    ) {
      const timeSinceLastFetch = now - state.lastFetchConnections;
      if (timeSinceLastFetch < CACHE_DURATION) {
        console.log('Using cached connections data');
        return;
      }
    }

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
      set({
        connections: data.connections,
        isLoading: false,
        lastFetchConnections: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  fetchJobs: async (token: string, forceRefresh = false) => {
    const state = get();
    const now = Date.now();

    // Si ya tenemos datos y no es force refresh, verificar cache
    if (!forceRefresh && state.jobs.length > 0 && state.lastFetchJobs) {
      const timeSinceLastFetch = now - state.lastFetchJobs;
      if (timeSinceLastFetch < CACHE_DURATION) {
        console.log('Using cached jobs data');
        return;
      }
    }

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
      set({
        jobs: data.jobs,
        isLoading: false,
        lastFetchJobs: Date.now(),
      });
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

  deleteVideo: async (token: string, videoId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/videos/${videoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        let message = 'Error al eliminar video';
        try {
          const error = await response.json();
          if (error?.message) message = error.message;
        } catch (err) {
          console.error('Delete video parse error:', err);
        }
        throw new Error(message);
      }

      const now = Date.now();
      set(state => ({
        jobs: state.jobs.filter(job => job.id !== videoId),
        isLoading: false,
        lastFetchJobs: now,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deletePublishJob: async (token: string, jobId: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`${API_URL}/publish/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        let message = 'Error al eliminar publicación';
        try {
          const error = await response.json();
          if (error?.message) message = error.message;
        } catch (err) {
          console.error('Delete publish job parse error:', err);
        }
        throw new Error(message);
      }

      const now = Date.now();
      set(state => ({
        jobs: state.jobs.filter(job => job.id !== jobId),
        isLoading: false,
        lastFetchJobs: now,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      set({ error: message, isLoading: false });
      throw error;
    }
  },
}));
