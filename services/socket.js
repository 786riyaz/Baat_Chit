import { io } from "socket.io-client";
import { getToken } from "./api";

// Same-origin now, so no URL is needed - io() with no address connects back
// to whatever origin served this page. NEXT_PUBLIC_SOCKET_URL is only for
// the (unlikely, with this architecture) case of a separately deployed API.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || undefined;

let socket = null;

export function getSocket() {
  if (socket) return socket;
  const options = {
    autoConnect: false,
    auth: (callback) => callback({ token: getToken() })
  };
  socket = SOCKET_URL ? io(SOCKET_URL, options) : io(options);
  return socket;
}

export function connectSocket() {
  const instance = getSocket();
  if (!instance.connected) instance.connect();
  return instance;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
