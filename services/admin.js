import { api } from "./api";

export async function getAdminStats() {
  const data = await api.get("/api/admin/stats");
  return data.stats;
}

export async function listAllUsers(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const data = await api.get(`/api/admin/users${query}`);
  return data.users;
}

export async function listPendingUsers() {
  const data = await api.get("/api/admin/users/pending");
  return data.users;
}

export async function approveUser(userId) {
  const data = await api.put(`/api/admin/users/${userId}/approve`, {});
  return data.user;
}

export async function suspendUser(userId) {
  const data = await api.put(`/api/admin/users/${userId}/suspend`, {});
  return data.user;
}

export async function rejectUser(userId) {
  const data = await api.put(`/api/admin/users/${userId}/reject`, {});
  return data.user;
}

export async function revokeApproval(userId) {
  const data = await api.put(`/api/admin/users/${userId}/revoke-approval`, {});
  return data.user;
}
