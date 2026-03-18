import axios from 'axios';

const BASE_CLIENT_URL = import.meta.env.VITE_BASE_CLIENT_URL;
const BASE_BO_URL = import.meta.env.VITE_BASE_BO_URL;

export const clientApi = axios.create({
  baseURL: BASE_CLIENT_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-humand-origin': 'web',
  },
});

export const backofficeApi = axios.create({
  baseURL: BASE_BO_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-humand-origin': 'backoffice',
  },
});

// Client API interceptor — uses client tokens
clientApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

clientApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const res = await axios.get(`${BASE_CLIENT_URL}/auth/refresh`, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          localStorage.setItem('accessToken', res.data.accessToken);
          localStorage.setItem('refreshToken', res.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return clientApi(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Backoffice API interceptor — uses backoffice tokens
backofficeApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('boAccessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

backofficeApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retry) {
      error.config._retry = true;
      const refreshToken = localStorage.getItem('boRefreshToken');
      if (refreshToken) {
        try {
          const res = await axios.get(`${BASE_BO_URL}/auth/refresh`, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          localStorage.setItem('boAccessToken', res.data.accessToken);
          localStorage.setItem('boRefreshToken', res.data.refreshToken);
          error.config.headers.Authorization = `Bearer ${res.data.accessToken}`;
          return backofficeApi(error.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default clientApi;
