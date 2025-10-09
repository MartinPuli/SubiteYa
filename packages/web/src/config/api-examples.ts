// Example: How to use the API configuration in your components

import { API_ENDPOINTS, buildUrl } from '../config/api';

// Example 1: Simple fetch
export async function login(email: string, password: string) {
  const response = await fetch(API_ENDPOINTS.login, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    credentials: 'include', // Important for cookies
  });
  
  if (!response.ok) {
    throw new Error('Login failed');
  }
  
  return response.json();
}

// Example 2: With query parameters
export async function getConnections(userId: string) {
  const url = buildUrl(API_ENDPOINTS.connections, { userId });
  
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });
  
  return response.json();
}

// Example 3: With authentication token
export async function publishVideo(formData: FormData, token: string) {
  const response = await fetch(API_ENDPOINTS.publish, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
    credentials: 'include',
  });
  
  return response.json();
}

// Example 4: TikTok OAuth redirect
export function redirectToTikTokAuth() {
  // This will automatically use the correct API URL
  window.location.href = API_ENDPOINTS.tiktokAuth;
}
