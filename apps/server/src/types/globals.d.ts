declare global {
  // biome-ignore lint/style/noNamespace: Express uses global namespace
  namespace Express {
    interface Request {
      socketId: string; // Add socketId to the Request object with socketIdMiddleware.ts
    }
  }
}

// This is needed to make the file a module
export {};
