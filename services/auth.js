import { api, saveSession, saveUser } from "./api";

export async function login(loginValue, password) {
  const data = await api.post("/api/login", { login: loginValue, password });
  saveSession(data.token, data.user);
  return data.user;
}

export async function signup({ name, email, phone, password }) {
  return api.post("/api/signup", { name, email, phone, password });
}

export async function fetchCurrentUser() {
  const data = await api.get("/api/users/me");
  saveUser(data.user);
  return data.user;
}

export async function forgotPassword(email) {
  return api.post("/api/auth/forgot-password", { email });
}

export async function resetPassword(token, password) {
  return api.post("/api/auth/reset-password", { token, password });
}

export async function updateProfile(payload) {
  const data = await api.put("/api/users/me", payload);
  saveUser(data.user);
  return data.user;
}

export async function uploadProfilePhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);
  const data = await api.put("/api/users/me/profile-photo", formData);
  saveUser(data.user);
  return data.user;
}
