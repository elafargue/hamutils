/**
 * API Configuration Module
 * Provides centralized configuration for backend API endpoints
 */

// Get the base API URL from environment variables or default to localhost:8000
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

/**
 * Get the base API URL for HTTP requests
 * @returns The configured API base URL
 */
export const getApiUrl = (): string => {
  return API_BASE_URL;
};

/**
 * Get the WebSocket URL for real-time connections
 * @returns The WebSocket URL based on the API base URL
 */
export const getWebSocketUrl = (): string => {
  // Convert HTTP(S) URL to WebSocket URL
  const protocol = API_BASE_URL.startsWith('https') ? 'wss:' : 'ws:';
  const baseUrl = API_BASE_URL.replace(/^https?:/, '');
  return `${protocol}${baseUrl}`;
};

/**
 * Helper function to construct API URLs with endpoints
 * @param endpoint The endpoint path (should start with /)
 * @returns The complete URL for the endpoint
 */
export const getApiEndpoint = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

/**
 * Helper function to get WebSocket URL with endpoint
 * @param endpoint The WebSocket endpoint (default: '/ws')
 * @returns The complete WebSocket URL
 */
export const getWebSocketEndpoint = (endpoint: string = '/ws'): string => {
  const protocol = API_BASE_URL.startsWith('https') ? 'wss:' : 'ws:';
  const baseUrl = API_BASE_URL.replace(/^https?:/, '');
  return `${protocol}${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// Export the base URL for direct use if needed
export { API_BASE_URL };

/**
 * Configuration object with all API-related URLs
 */
export const apiConfig = {
  baseUrl: API_BASE_URL,
  endpoints: {
    health: `${API_BASE_URL}/health`,
    config: `${API_BASE_URL}/config`,
    topology: `${API_BASE_URL}/topology`,
    websocket: getWebSocketEndpoint('/ws'),
  },
};

export default apiConfig;