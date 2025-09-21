import { Request, Response, NextFunction } from 'express';

// Extend the Session interface to include userId
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export const checkAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ message: 'Authentication required' });
  }
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  next();
};