import { fromNodeHeaders } from "better-auth/node";
import type { NextFunction, Request, Response } from "express";
import type { Socket } from "socket.io";
import { env } from "../env.ts";
import { auth } from "../lib/auth.ts";

// auth middleware for socket.io
export const socketAuth = async (
  socket: Socket,
  next: (err?: Error) => void,
) => {
  if (env.IGNORE_LOGIN) {
    return next();
  }

  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(socket.request.headers),
    });

    if (!session?.user) {
      console.error("Socket authentication error: Invalid token");
      return next(new Error("Authentication failed: Invalid token"));
    }

    return next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    return next(new Error("Unable to verify token"));
  }
};

// middleware for requiring the socket id
export const requireSocketId = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const socketId = req.header("X-Socket-ID");

  if (!socketId) {
    res.status(400).json({ message: "X-Socket-ID header is required" });
    return;
  }

  req.socketId = socketId;
  return next();
};
