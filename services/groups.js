import { api } from "./api";

export async function createGroup({ name, description, memberEmails }) {
  const data = await api.post("/api/groups", { name, description, memberEmails });
  return data.group;
}

export async function listGroups() {
  const data = await api.get("/api/groups");
  return data.groups;
}

export async function getGroup(groupId) {
  const data = await api.get(`/api/groups/${groupId}`);
  return data.group;
}

export async function updateGroup(groupId, payload) {
  const data = await api.put(`/api/groups/${groupId}`, payload);
  return data.group;
}

export async function uploadGroupImage(groupId, file) {
  const formData = new FormData();
  formData.append("image", file);
  const data = await api.put(`/api/groups/${groupId}/image`, formData);
  return data.group;
}

export async function addGroupMembers(groupId, memberEmails) {
  const data = await api.post(`/api/groups/${groupId}/members`, { memberEmails });
  return data.group;
}

export async function removeGroupMember(groupId, userId) {
  const data = await api.delete(`/api/groups/${groupId}/members/${userId}`);
  return data.group;
}

export async function leaveGroup(groupId) {
  return api.post(`/api/groups/${groupId}/leave`, {});
}

export async function promoteGroupAdmin(groupId, userId) {
  const data = await api.put(`/api/groups/${groupId}/admins/${userId}/promote`, {});
  return data.group;
}

export async function demoteGroupAdmin(groupId, userId) {
  const data = await api.put(`/api/groups/${groupId}/admins/${userId}/demote`, {});
  return data.group;
}
