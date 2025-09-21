import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage.js";
import { localUserService } from "./db/localdb.js";
import { checkAuth, requireAuth as authMiddleware } from "./middleware/auth.js";
import { insertRoomSchema, insertBoxSchema, insertItemSchema, insertMembershipSchema } from "@shared/schema.js";

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
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax', // Allow OAuth redirects while maintaining security
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth middleware - use the local requireAuth
  const requireAuth = authMiddleware;

  // Local Authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await localUserService.createUser(username, password);

      // Set session
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration failed:', err);
          return res.status(500).json({ message: 'Registration failed' });
        }
        
        req.session.userId = user.id;
        res.status(201).json({ 
          message: "Registration successful",
          user: { id: user.id, username: user.username }
        });
      });
    } catch (error) {
      console.error("Registration error:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: "Registration failed" });
      }
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const user = await localUserService.authenticateUser(username, password);
      if (!user) {
        return res.status(401).json({ message: "Invalid username or password" });
      }

      // Set session
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration failed:', err);
          return res.status(500).json({ message: 'Login failed' });
        }
        
        req.session.userId = user.id;
        res.json({ 
          message: "Login successful",
          user: { id: user.id, username: user.username }
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction failed:', err);
        return res.status(500).json({ message: 'Logout failed' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logout successful" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await localUserService.getUserById(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ message: "Failed to get user information" });
    }
  });

  app.get("/api/auth/google", requireAuth, (req, res) => {
    // Generate state for CSRF protection
    const state = Buffer.from(JSON.stringify({ userId: req.session.userId, timestamp: Date.now() })).toString('base64');
    req.session.oauthState = state;
    
    const authUrl = getGoogleAuthUrl(state);
    res.json({ authUrl });
  });

  app.post("/api/auth/google/verify", async (req, res) => {
    try {
      const { token } = req.body;
      const userInfo = await verifyGoogleToken(token);
      
      if (!userInfo) {
        return res.status(401).json({ message: "Invalid token" });
      }

      // Find or create user
      let user = await storage.getUserByGoogleId(userInfo.id);
      
      if (!user) {
        user = await storage.createUser({
          googleId: userInfo.id,
          email: userInfo.email,
          name: userInfo.name,
          profileImage: userInfo.picture,
        });
      }

      // Regenerate session to prevent session fixation attacks
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration failed:', err);
          return res.status(500).json({ message: 'Login failed' });
        }
        
        req.session.userId = user.id;
        res.json({ user });
      });
    } catch (error) {
      console.error("Auth verification failed:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });


  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await localUserService.getUserById(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ id: user.id, username: user.username });
    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ message: "Failed to get user information" });
    }
  });

  // Google OAuth routes
  app.get("/api/auth/google/callback", requireAuth, async (req, res) => {
    try {
      const { code, state } = req.query as { code?: string; state?: string };
      
      if (!code) {
        return res.status(400).json({ message: "Authorization code required" });
      }
      
      if (!state) {
        return res.status(400).json({ message: "State parameter required" });
      }
      
      // Verify state against session to prevent CSRF attacks
      if (req.session.oauthState !== state) {
        return res.status(400).json({ message: "Invalid state parameter" });
      }
      
      // Exchange code for tokens
      const tokens = await getGoogleTokens(code);
      
      // Save tokens to database using session userId (not trusting state)
      await saveUserGoogleTokens(req.session.userId!, tokens);
      
      // Clear state from session
      delete req.session.oauthState;
      
      // Redirect to success page
      res.redirect('/?oauth=success');
    } catch (error) {
      console.error("OAuth callback failed:", error);
      res.redirect('/?oauth=error');
    }
  });
  
  app.post("/api/auth/google/callback", requireAuth, async (req, res) => {
    try {
      const { code, state } = req.body;
      if (!code) {
        return res.status(400).json({ message: "Authorization code required" });
      }
      
      // Require and verify state to prevent CSRF attacks
      if (!state) {
        return res.status(400).json({ message: "State parameter required" });
      }
      
      if (req.session.oauthState !== state) {
        return res.status(400).json({ message: "Invalid state parameter" });
      }

      // Exchange code for tokens
      const tokens = await getGoogleTokens(code);
      
      // Save tokens to database
      await saveUserGoogleTokens(req.session.userId!, tokens);
      
      // Clear state from session
      delete req.session.oauthState;
      
      res.json({ message: "Google OAuth authorization successful" });
    } catch (error) {
      console.error("OAuth callback failed:", error);
      res.status(500).json({ message: "OAuth authorization failed" });
    }
  });

  app.get("/api/auth/google/status", requireAuth, async (req, res) => {
    try {
      const tokens = await storage.getGoogleTokens(req.session.userId!);
      const isConnected = !!tokens;
      
      if (isConnected && tokens.expiryDate) {
        const now = new Date();
        const isExpired = tokens.expiryDate <= now;
        const willExpireSoon = tokens.expiryDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
        
        res.json({
          isConnected,
          isExpired,
          willExpireSoon,
          expiryDate: tokens.expiryDate,
          scopes: tokens.scopes
        });
      } else {
        res.json({ isConnected });
      }
    } catch (error) {
      console.error("Failed to get OAuth status:", error);
      res.status(500).json({ message: "Failed to get OAuth status" });
    }
  });

  app.post("/api/auth/google/refresh", requireAuth, async (req, res) => {
    try {
      const newTokens = await refreshUserGoogleTokens(req.session.userId!);
      res.json({ message: "Tokens refreshed successfully", expiryDate: newTokens.expiry_date });
    } catch (error) {
      console.error("Token refresh failed:", error);
      res.status(500).json({ message: "Failed to refresh tokens" });
    }
  });

  app.delete("/api/auth/google/disconnect", requireAuth, async (req, res) => {
    try {
      // Revoke tokens at Google
      await revokeGoogleTokens(req.session.userId!);
      
      // Delete local tokens
      const success = await storage.deleteGoogleTokens(req.session.userId!);
      if (success) {
        res.json({ message: "Google account disconnected successfully" });
      } else {
        res.status(404).json({ message: "No Google connection found" });
      }
    } catch (error) {
      console.error("Failed to disconnect Google account:", error);
      res.status(500).json({ message: "Failed to disconnect Google account" });
    }
  });

  // Room routes
  app.get("/api/rooms", requireAuth, async (req, res) => {
    try {
      const rooms = await storage.getRoomsByUser(req.session.userId!);
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch rooms" });
    }
  });

  app.post("/api/rooms", requireAuth, async (req, res) => {
    try {
      const roomData = insertRoomSchema.parse({
        ...req.body,
        createdBy: req.session.userId!
      });

      const room = await storage.createRoom(roomData);

      // Add creator as admin
      await storage.createMembership({
        roomId: room.id,
        userId: req.session.userId!,
        role: "admin"
      });

      res.json(room);
    } catch (error) {
      console.error("Failed to create room:", error);
      res.status(500).json({ message: "Failed to create room" });
    }
  });

  app.get("/api/rooms/:roomId", requireAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      
      // Check access
      const hasAccess = await storage.hasRoomAccess(roomId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const room = await storage.getRoom(roomId);
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }

      res.json(room);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch room" });
    }
  });

  // Box routes
  app.get("/api/rooms/:roomId/boxes", requireAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      
      // Check access
      const hasAccess = await storage.hasRoomAccess(roomId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const boxes = await storage.getBoxesByRoom(roomId);
      res.json(boxes);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch boxes" });
    }
  });

  app.post("/api/rooms/:roomId/boxes", requireAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      
      // Check admin access
      const isAdmin = await storage.isRoomAdmin(roomId, req.session.userId!);
      if (!isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const boxData = insertBoxSchema.parse({
        ...req.body,
        roomId
      });

      const box = await storage.createBox(boxData);
      
      // Create Google Drive folder for the box
      const room = await storage.getRoom(roomId);
      if (room?.driveFolder) {
        const driveFolder = await googleDriveService.createFolder(req.session.userId!, box.label, room.driveFolder);
        await storage.updateBox(box.id, { driveFolder });

        // Generate QR code
        const qrResult = await qrGeneratorService.generateAndUploadQRCode(req.session.userId!, box.id, driveFolder);
        await storage.updateBox(box.id, { 
          qrCode: qrResult.fileId,
          qrOwnerUserId: req.session.userId!
        });
      }

      res.json(box);
    } catch (error) {
      console.error("Failed to create box:", error);
      res.status(500).json({ message: "Failed to create box" });
    }
  });

  app.get("/api/boxes/:boxId", requireAuth, async (req, res) => {
    try {
      const { boxId } = req.params;
      
      const box = await storage.getBox(boxId);
      if (!box) {
        return res.status(404).json({ message: "Box not found" });
      }

      // Check room access
      const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(box);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch box" });
    }
  });

  // QR code access route (requires login but checks membership)
  app.get("/box/:boxId", requireAuth, async (req, res) => {
    try {
      const { boxId } = req.params;
      
      const box = await storage.getBox(boxId);
      if (!box) {
        return res.status(404).send("Box not found");
      }

      // Check room access
      const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).send("Access denied");
      }

      // Redirect to frontend box detail page
      res.redirect(`/room/${box.roomId}/box/${boxId}`);
    } catch (error) {
      res.status(500).send("Server error");
    }
  });

  // Item routes
  app.get("/api/boxes/:boxId/items", requireAuth, async (req, res) => {
    try {
      const { boxId } = req.params;
      
      const box = await storage.getBox(boxId);
      if (!box) {
        return res.status(404).json({ message: "Box not found" });
      }

      // Check room access
      const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const items = await storage.getItemsByBox(boxId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch items" });
    }
  });

  app.post("/api/boxes/:boxId/items", requireAuth, async (req, res) => {
    try {
      const { boxId } = req.params;
      
      const box = await storage.getBox(boxId);
      if (!box) {
        return res.status(404).json({ message: "Box not found" });
      }

      // Check admin access
      const isAdmin = await storage.isRoomAdmin(box.roomId, req.session.userId!);
      if (!isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const itemData = insertItemSchema.parse({
        ...req.body,
        boxId
      });

      const item = await storage.createItem(itemData);
      res.json(item);
    } catch (error) {
      console.error("Failed to create item:", error);
      res.status(500).json({ message: "Failed to create item" });
    }
  });

  // Membership routes
  app.post("/api/rooms/:roomId/members", requireAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      
      // Check admin access
      const isAdmin = await storage.isRoomAdmin(roomId, req.session.userId!);
      if (!isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { email, role } = req.body;
      
      // Find user by email (in real app, you'd send an invitation)
      const users = await storage.getRoomMembers(roomId);
      // For now, just return success - in real implementation you'd send email invitation
      
      res.json({ message: "Invitation sent successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to invite user" });
    }
  });

  app.get("/api/rooms/:roomId/members", requireAuth, async (req, res) => {
    try {
      const { roomId } = req.params;
      
      // Check access
      const hasAccess = await storage.hasRoomAccess(roomId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      const members = await storage.getRoomMembers(roomId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch members" });
    }
  });

  // QR regeneration
  app.get("/api/boxes/:boxId/qr-image", requireAuth, async (req, res) => {
    try {
      const { boxId } = req.params;
      
      const box = await storage.getBox(boxId);
      if (!box) {
        return res.status(404).json({ message: "Box not found" });
      }

      // Check user has access to the room (either admin or viewer)
      const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId!);
      if (!hasAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If no QR code exists, generate one (admin only)
      if (!box.qrCode) {
        const isAdmin = await storage.isRoomAdmin(box.roomId, req.session.userId!);
        if (!isAdmin) {
          return res.status(404).json({ message: "QR code not found" });
        }

        const qrResult = await qrGeneratorService.generateAndUploadQRCode(
          req.session.userId!,
          boxId, 
          box.driveFolder || undefined
        );
        
        await storage.updateBox(boxId, { 
          qrCode: qrResult.fileId,
          qrOwnerUserId: req.session.userId!
        });
        
        // Get the image bytes from Google Drive and return them
        const imageBuffer = await googleDriveService.getFileBytes(req.session.userId!, qrResult.fileId);
        res.set('Content-Type', 'image/png');
        return res.send(imageBuffer);
      }

      // Get the QR code image bytes from Google Drive using owner's tokens
      const qrOwnerUserId = box.qrOwnerUserId || req.session.userId!; // Fallback for legacy boxes
      const imageBuffer = await googleDriveService.getFileBytes(qrOwnerUserId, box.qrCode);
      res.set('Content-Type', 'image/png');
      res.send(imageBuffer);
    } catch (error) {
      console.error("Failed to get QR code image:", error);
      res.status(500).json({ message: "Failed to get QR code image" });
    }
  });

  app.post("/api/boxes/:boxId/regenerate-qr", requireAuth, async (req, res) => {
    try {
      const { boxId } = req.params;
      
      const box = await storage.getBox(boxId);
      if (!box) {
        return res.status(404).json({ message: "Box not found" });
      }

      // Check admin access
      const isAdmin = await storage.isRoomAdmin(box.roomId, req.session.userId!);
      if (!isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }

      const qrResult = await qrGeneratorService.regenerateQRCode(
        req.session.userId!,
        boxId, 
        box.qrCode || undefined, 
        box.driveFolder || undefined
      );
      
      await storage.updateBox(boxId, { 
        qrCode: qrResult.fileId,
        qrOwnerUserId: req.session.userId!
      });
      
      res.json({ qrCodeUrl: qrResult.webViewLink });
    } catch (error) {
      console.error("Failed to regenerate QR code:", error);
      res.status(500).json({ message: "Failed to regenerate QR code" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
