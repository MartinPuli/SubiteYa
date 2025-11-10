// API Configuration
// Automatically uses the correct API URL based on environment

export const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD
    ? 'https://subiteya-h9ol.onrender.com/api'
    : 'http://localhost:3000/api');

export const API_ENDPOINTS = {
  // Auth
  login: `${API_BASE_URL}/auth/login`,
  register: `${API_BASE_URL}/auth/register`,
  logout: `${API_BASE_URL}/auth/logout`,
  me: `${API_BASE_URL}/auth/me`,
  verifyEmail: `${API_BASE_URL}/auth/verify-email`,
  resendVerification: `${API_BASE_URL}/auth/resend-verification`,
  forgotPassword: `${API_BASE_URL}/auth/forgot-password`,
  resetPassword: `${API_BASE_URL}/auth/reset-password`,

  // TikTok OAuth
  tiktokAuth: `${API_BASE_URL}/auth/tiktok`,
  tiktokCallback: `${API_BASE_URL}/auth/tiktok/callback`,

  // Connections
  connections: `${API_BASE_URL}/connections`,

  // Publishing
  publish: `${API_BASE_URL}/publish`,
  publishBatch: `${API_BASE_URL}/publish/batch`,

  // Queue System
  videos: `${API_BASE_URL}/videos`,
  meQueues: `${API_BASE_URL}/me/queues`,
  events: `${API_BASE_URL}/events`,

  // Brand Patterns
  patterns: `${API_BASE_URL}/patterns`,
  uploadLogo: `${API_BASE_URL}/patterns/upload-logo`,

  // ElevenLabs Voice
  elevenlabsVoices: `${API_BASE_URL}/elevenlabs/voices`,
  elevenlabsClone: `${API_BASE_URL}/elevenlabs/clone`,
  elevenlabsGenerate: `${API_BASE_URL}/elevenlabs/generate`,
  elevenlabsDefaultVoices: `${API_BASE_URL}/elevenlabs/default-voices`,
};

// Helper function to build URLs with query params
export const buildUrl = (endpoint: string, params?: Record<string, string>) => {
  if (!params) return endpoint;

  const queryString = new URLSearchParams(params).toString();
  return `${endpoint}?${queryString}`;
};
