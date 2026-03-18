import axios from 'axios';

const BASE_CLIENT_URL = import.meta.env.VITE_BASE_CLIENT_URL;
const BASE_BO_URL = import.meta.env.VITE_BASE_BO_URL;
const INSTANCE_ID = Number(import.meta.env.VITE_INSTANCE_ID);

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    profileImage: string | null;
  };
  instance: {
    id: number;
    name: string;
    color: string;
    logo: string;
  };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const loginPayload = {
      employeeInternalId: email,
      instanceId: INSTANCE_ID,
      password,
    };

    // Login against both APIs in parallel
    const [clientRes, boRes] = await Promise.all([
      axios.post(`${BASE_CLIENT_URL}/auth/login`, loginPayload),
      axios.post(`${BASE_BO_URL}/auth/login`, loginPayload),
    ]);

    // Store client tokens
    localStorage.setItem('accessToken', clientRes.data.accessToken);
    localStorage.setItem('refreshToken', clientRes.data.refreshToken);

    // Store backoffice tokens separately
    localStorage.setItem('boAccessToken', boRes.data.accessToken);
    localStorage.setItem('boRefreshToken', boRes.data.refreshToken);

    // Store user and instance info
    localStorage.setItem('user', JSON.stringify(clientRes.data.user));
    localStorage.setItem('instance', JSON.stringify(clientRes.data.instance));

    return clientRes.data;
  },

  logout() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('boAccessToken');
    localStorage.removeItem('boRefreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('instance');
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },

  getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  getInstance() {
    const instance = localStorage.getItem('instance');
    return instance ? JSON.parse(instance) : null;
  },
};
