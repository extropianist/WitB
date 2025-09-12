import type { Express } from "express";
import { createServer, type Server } from "http";
import session from "express-session";
import { storage } from "./storage.js";
import { verifyGoogleToken, getGoogleAuthUrl, getGoogleTokens, saveUserGoogleTokens, refreshUserGoogleTokens, revokeGoogleTokens } from "./services/google-auth.js";
import { googleDriveService } from "./services/google-drive.js";
import { qrGeneratorService } from "./services/qr-generator.js";
import { insertRoomSchema, insertBoxSchema, insertItemSchema, insertMembershipSchema } from "@shared/schema.js";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || "default_session_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth middleware
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Auth routes
  app.get("/api/auth/config", (req, res) => {
    res.json({ 
      googleClientId: process.env.GOOGLE_CLIENT_ID 
    });
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

      req.session.userId = user.id;
      res.json({ user });
    } catch (error) {
      console.error("Auth verification failed:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.session.userId!);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ user });
    } catch (error) {
      res.status(500).json({ message: "Failed to get user info" });
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
      
      // Create Google Drive folder for the room
      const driveFolder = await googleDriveService.createFolder(req.session.userId!, room.name);
      await storage.updateRoom(room.id, { driveFolder });

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
        await storage.updateBox(box.id, { qrCode: qrResult.fileId });
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
      
      await storage.updateBox(boxId, { qrCode: qrResult.fileId });
      
      res.json({ qrCodeUrl: qrResult.webViewLink });
    } catch (error) {
      console.error("Failed to regenerate QR code:", error);
      res.status(500).json({ message: "Failed to regenerate QR code" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
