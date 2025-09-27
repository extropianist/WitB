import { Router } from "express";
import { storage } from "../storage.js";
import { requireAuth } from "../middleware/auth.js";
import { insertRoomSchema } from "@shared/schema.js";
import { csvExporterService } from "../services/csv-exporter.js";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const rooms = await storage.getRoomsByUser(req.session.userId);
    res.json(rooms);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch rooms" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const roomData = insertRoomSchema.parse({
      ...req.body,
      createdBy: req.session.userId
    });

    const room = await storage.createRoom(roomData);

    // Add creator as admin
    await storage.createMembership({
      roomId: room.id,
      userId: req.session.userId,
      role: "admin"
    });

    res.status(201).json(room);
  } catch (error) {
    console.error("Failed to create room:", error);
    res.status(500).json({ message: "Failed to create room" });
  }
});

router.get("/:roomId", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { roomId } = req.params;

    // Check access
    const hasAccess = await storage.hasRoomAccess(roomId, req.session.userId);
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

// Membership routes
router.post("/:roomId/members", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { roomId } = req.params;

    // Check admin access
    const isAdmin = await storage.isRoomAdmin(roomId, req.session.userId);
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

router.get("/:roomId/members", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { roomId } = req.params;

    // Check access
    const hasAccess = await storage.hasRoomAccess(roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const members = await storage.getRoomMembers(roomId);
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch members" });
  }
});

// CSV Export routes
router.get("/:roomId/export-csv", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { roomId } = req.params;

    const room = await storage.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check user has access to the room
    const hasAccess = await storage.hasRoomAccess(roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Generate combined CSV
    const csvData = await csvExporterService.generateCombinedCsv(roomId);

    // Set response headers for CSV download
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="room-export-${room.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv"`,
      'Content-Length': Buffer.byteLength(csvData, 'utf8').toString()
    });

    res.send(csvData);
  } catch (error) {
    console.error("Failed to export room CSV:", error);
    res.status(500).json({ message: "Failed to export room data" });
  }
});

router.get("/:roomId/export-detailed", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { roomId } = req.params;

    const room = await storage.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Check user has access to the room
    const hasAccess = await storage.hasRoomAccess(roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Generate separate CSV files
    const { roomCsv, boxesCsv, itemsCsv } = await csvExporterService.exportRoomData(roomId);

    // For now, return the combined data as a single CSV
    // TODO: In the future, this could return a ZIP file with separate CSVs
    const combinedCsv = `# Room Data\n${roomCsv}\n\n# Boxes Data\n${boxesCsv}\n\n# Items Data\n${itemsCsv}`;

    // Set response headers for CSV download
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="room-detailed-export-${room.name.replace(/[^a-zA-Z0-9]/g, '-')}.csv"`,
      'Content-Length': Buffer.byteLength(combinedCsv, 'utf8').toString()
    });

    res.send(combinedCsv);
  } catch (error) {
    console.error("Failed to export detailed room CSV:", error);
    res.status(500).json({ message: "Failed to export detailed room data" });
  }
});

export default router;