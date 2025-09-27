import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "./db.js";
import { localUserService } from "./db/localdb.js";
import apiRouter from "./api/index.js";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize local database
  await localUserService.init();
  
  // Require SESSION_SECRET for security
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is required for secure sessions');
  }
  
  // Enable trust proxy for secure cookies behind reverse proxy
  app.set('trust proxy', 1);
  
  // Session middleware with production-ready security
  const PgSession = ConnectPgSimple(session);
  app.use(session({
    store: new PgSession({
      pool,
      tableName: 'user_sessions',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Register API routes
  app.use('/api', apiRouter);

  const httpServer = createServer(app);
  return httpServer;
}