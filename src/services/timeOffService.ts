import { clientApi, backofficeApi } from '../config/api';

// ---- Client API (employee-facing) ----

export const timeOffClientService = {
  // Get policy types for current user
  async getPolicyTypes() {
    const { data } = await clientApi.get('/vacations/policies');
    return data;
  },

  // Get policy type detail
  async getPolicyTypeDetail(policyTypeId: string, userId?: number) {
    const params = userId ? { userId } : {};
    const { data } = await clientApi.get(`/vacations/policy-types/${policyTypeId}`, { params });
    return data;
  },

  // Get balances report
  async getBalancesReport(params: Record<string, unknown> = {}) {
    const { data } = await clientApi.get('/vacations/balances', { params });
    return data;
  },

  // Get events for a policy type
  async getEvents(policyTypeId: string, params: Record<string, unknown> = {}) {
    const { data } = await clientApi.get(`/vacations/policy-types/${policyTypeId}/events`, { params });
    return data;
  },

  // Get cycles for a policy type
  async getCycles(policyTypeId: string, params: Record<string, unknown> = {}) {
    const { data } = await clientApi.get(`/vacations/policy-types/${policyTypeId}/cycles`, {
      params: { page: 1, limit: 10, ...params },
    });
    return data;
  },

  // Get projected balance
  async getProjectedBalance(policyTypeId: string, userId?: number) {
    const params = userId ? { userId } : {};
    const { data } = await clientApi.get(`/vacations/policy-types/${policyTypeId}/projected-balance`, { params });
    return data;
  },

  // Get requests (collaborator)
  async getRequests(params: Record<string, unknown> = {}) {
    const { data } = await clientApi.get('/vacations/requests', { params });
    return data;
  },

  // Get single request detail
  async getRequest(requestId: number) {
    const { data } = await clientApi.get(`/vacations/requests/${requestId}`);
    return data;
  },

  // Preview request (calculate days)
  async previewRequest(payload: Record<string, unknown>) {
    const { data } = await clientApi.post('/vacations/requests/preview', payload);
    return data;
  },

  // Get calendar data
  async getCalendar(params: Record<string, unknown> = {}) {
    const { data } = await clientApi.get('/vacations/calendar', { params });
    return data;
  },

  // Get balance report
  async getBalanceReport(params: Record<string, unknown> = {}) {
    const { data } = await clientApi.get('/vacations/balances/report', { params });
    return data;
  },
};

// ---- Backoffice API (admin-facing) ----

export const timeOffAdminService = {
  // List all policies
  async getPolicies(params: Record<string, unknown> = {}) {
    const { data } = await backofficeApi.get('/vacations/policies', { params });
    return data;
  },

  // Get single policy
  async getPolicy(policyId: string) {
    const { data } = await backofficeApi.get(`/vacations/policies/${policyId}`);
    return data;
  },

  // List policy types
  async getPolicyTypes() {
    const { data } = await backofficeApi.get('/vacations/policy-types');
    return data;
  },

  // Get policy type detail
  async getPolicyType(policyTypeId: string) {
    const { data } = await backofficeApi.get(`/vacations/policy-types/${policyTypeId}`);
    return data;
  },

  // Get approval users
  async getApprovalUsers() {
    const { data } = await backofficeApi.get('/vacations/approval-users');
    return data;
  },

  // Get conflicts
  async getConflicts(params: Record<string, unknown> = {}) {
    const { data } = await backofficeApi.get('/vacations/conflicts', { params });
    return data;
  },
};
