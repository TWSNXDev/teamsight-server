import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";

export let io: Server;

interface OnlineUser {
  id: string;
  name: string;
}

const onlineUsers = new Map<string, OnlineUser>();

function broadcastOnlineUsers() {
  const uniqueUsers = new Map<string, OnlineUser>();
  for (const user of onlineUsers.values()) {
    uniqueUsers.set(user.id, user);
  }
  io.emit("online-users", Array.from(uniqueUsers.values()));
}

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.use(async (socket: Socket, next) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(socket.handshake.headers),
    });

    if (!session) {
      next(new Error("Unauthorized"));
      return;
    }

    socket.data.user = { id: session.user.id, name: session.user.name };
    next();
  });

  io.on("connection", (socket) => {
    onlineUsers.set(socket.id, socket.data.user);
    broadcastOnlineUsers();

    socket.on("disconnect", () => {
      onlineUsers.delete(socket.id);
      broadcastOnlineUsers();
    });
  });

  return io;
}
