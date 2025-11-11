/**
 * API Client with automatic token refresh
 */

import { useAuthStore } from '../store/authStore';
import { API_BASE_URL } from '../config/api';

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

/**
 * Enhanced fetch that automatically handles token refresh
 */
export async function apiClient(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const { skipAuth, ...fetchOptions } = options;

  // Get current token
  const token = useAuthStore.getState().token;

  // Add auth header if not skipped and token exists
  if (!skipAuth && token) {
    fetchOptions.headers = {
      ...fetchOptions.headers,
      Authorization: `Bearer ${token}`,
    };
  }

  // Make initial request
  let response = await fetch(url, fetchOptions);

  // If 401 and we have a refresh token, try to refresh
  if (response.status === 401 && !skipAuth) {
    const refreshToken = useAuthStore.getState().refreshToken;

    if (refreshToken) {
      try {
        // Refresh the token
        const newToken = await useAuthStore.getState().refreshAccessToken();

        // Retry the original request with new token
        fetchOptions.headers = {
          ...fetchOptions.headers,
          Authorization: `Bearer ${newToken}`,
        };

        response = await fetch(url, fetchOptions);
      } catch (error) {
        // Refresh failed - user will need to login again
        console.error('Token refresh failed:', error);
        throw new Error('Session expired. Please login again.');
      }
    }
  }

  return response;
}

/**
 * Auto-refresh setup - checks token expiration and refreshes proactively
 */
export function setupAutoRefresh() {
  // Check token expiration every 5 minutes
  setInterval(
    async () => {
      const { token, refreshToken, isAuthenticated } = useAuthStore.getState();

      if (!isAuthenticated || !token || !refreshToken) {
        return;
      }

      try {
        // Decode JWT to check expiration (without verification)
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );

        const payload = JSON.parse(jsonPayload);
        const exp = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        const timeUntilExpiry = exp - now;

        // Refresh if token expires in less than 5 minutes
        if (timeUntilExpiry < 5 * 60 * 1000) {
          console.log('🔄 Auto-refreshing access token...');
          await useAuthStore.getState().refreshAccessToken();
          console.log('✅ Access token refreshed automatically');
        }
      } catch (error) {
        console.error('Auto-refresh check failed:', error);
      }
    },
    5 * 60 * 1000
  ); // Check every 5 minutes
}

// Build URL with base
export function buildApiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}
