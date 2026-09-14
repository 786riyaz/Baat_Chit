// Same-origin now: this Next.js app and the API/Socket.IO backend are one
// process on one port, so relative paths just work. NEXT_PUBLIC_API_URL is
// only needed if you ever split them back into separate deployments.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

const TOKEN_KEY = "chatapp_token";
const USER_KEY = "chatapp_user";

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(token, user) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function saveUser(user) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = { ...(options.headers || {}) };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: isFormData || options.body === undefined
      ? options.body
      : JSON.stringify(options.body)
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    // no JSON body (e.g. 204) - leave data as {}
  }

  if (!response.ok) {
    const error = new Error(data.message || `Request failed (${response.status})`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path, { method: "GET" }),
  post: (path, body) => request(path, { method: "POST", body }),
  put: (path, body) => request(path, { method: "PUT", body }),
  delete: (path) => request(path, { method: "DELETE" })
};

// fetch() has no upload-progress event, so file uploads that want a
// progress indicator go through XMLHttpRequest instead.
export function uploadWithProgress(path, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}${path}`);
    const token = getToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && typeof onProgress === "function") {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        // no/invalid JSON body
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(new Error(data.message || `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.send(formData);
  });
}
