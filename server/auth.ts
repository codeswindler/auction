/**
 * Authentication Middleware for Node.js/Express
 */

import type { Request, Response, NextFunction } from "express";

declare module "express-session" {
  interface SessionData {
    adminLoggedIn?: boolean;
    adminUsername?: string;
    lastActivity?: number;
  }
}

// Session timeout: 10 minutes (600000 milliseconds)
const SESSION_TIMEOUT = 10 * 60 * 1000;

/**
 * Check if the session has expired due to inactivity
 */
function isSessionExpired(req: Request): boolean {
  if (!req.session?.lastActivity) {
    return true;
  }
  
  const timeSinceLastActivity = Date.now() - req.session.lastActivity;
  return timeSinceLastActivity > SESSION_TIMEOUT;
}

/**
 * Update the last activity timestamp
 */
function updateLastActivity(req: Request) {
  if (req.session) {
    req.session.lastActivity = Date.now();
  }
}

/**
 * Clear expired session
 */
function clearExpiredSession(req: Request) {
  if (req.session) {
    req.session.adminLoggedIn = false;
    delete req.session.adminUsername;
    delete req.session.lastActivity;
  }
}

// Middleware to require admin authentication
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  // Allow access in development mode
  if (process.env.NODE_ENV === "development" || process.env.APP_DEBUG === "true") {
    return next();
  }

  // Check if session has expired
  if (isSessionExpired(req)) {
    clearExpiredSession(req);
    return res.status(401).json({ 
      error: "Unauthorized", 
      message: "Session expired due to inactivity. Please log in again." 
    });
  }

  // Check if admin is logged in
  if (!req.session?.adminLoggedIn) {
    return res.status(401).json({ 
      error: "Unauthorized", 
      message: "Admin authentication required" 
    });
  }

  // Update last activity on successful auth check
  updateLastActivity(req);

  next();
}

export function isAdminLoggedIn(req: Request): boolean {
  // Check if session has expired
  if (isSessionExpired(req)) {
    clearExpiredSession(req);
    return false;
  }

  const isLoggedIn = req.session?.adminLoggedIn === true;

  // Update last activity if logged in
  if (isLoggedIn) {
    updateLastActivity(req);
  }

  return isLoggedIn;
}

export function loginAdmin(req: Request, username: string, password: string): boolean {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (username === adminUsername && password === adminPassword) {
    if (req.session) {
      req.session.adminLoggedIn = true;
      req.session.adminUsername = username;
      req.session.lastActivity = Date.now(); // Set initial activity time
    }
    return true;
  }

  return false;
}

export function logoutAdmin(req: Request) {
  if (req.session) {
    req.session.adminLoggedIn = false;
    delete req.session.adminUsername;
    delete req.session.lastActivity;
  }
}

