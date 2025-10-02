import { Router } from "express";
import { storage } from "../storage.js";
import { requireAuth } from "../middleware/auth.js";
import { insertBoxSchema, insertItemSchema } from "@shared/schema.js";
import { qrGeneratorService } from "../services/qr-generator.js";
import { pdfGeneratorService } from "../services/pdf-generator.js";

const router = Router();

// Box routes
router.get("/:boxId", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { boxId } = req.params;

    const box = await storage.getBox(boxId);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Check room access
    const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(box);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch box" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { roomId } = req.body;

    // Check admin access
    const isAdmin = await storage.isRoomAdmin(roomId, req.session.userId);
    if (!isAdmin) {
      return res.status(403).json({ message: "Admin access required" });
    }

    const boxData = insertBoxSchema.parse({
      ...req.body,
      roomId
    });

    const box = await storage.createBox(boxData);

    res.status(201).json(box);
  } catch (error) {
    console.error("Failed to create box:", error);
    res.status(500).json({ message: "Failed to create box" });
  }
});

// Item routes
router.get("/:boxId/items", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { boxId } = req.params;

    const box = await storage.getBox(boxId);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Check room access
    const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    const items = await storage.getItemsByBox(boxId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch items" });
  }
});

router.post("/:boxId/items", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { boxId } = req.params;

    const box = await storage.getBox(boxId);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Check admin access
    const isAdmin = await storage.isRoomAdmin(box.roomId, req.session.userId);
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

// QR code generation
router.get("/:boxId/qr-image", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { boxId } = req.params;

    const box = await storage.getBox(boxId);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Check user has access to the room
    const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Generate QR code on the fly
    const qrCodeDataURL = await qrGeneratorService.generateQRCodeForBox(boxId);
    const base64Data = qrCodeDataURL.split(',')[1];
    const imageBuffer = Buffer.from(base64Data, 'base64');

    res.set('Content-Type', 'image/png');
    res.send(imageBuffer);
  } catch (error) {
    console.error("Failed to get QR code image:", error);
    res.status(500).json({ message: "Failed to get QR code image" });
  }
});

// Pull sheets routes
router.get("/:boxId/pull-sheet", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { boxId } = req.params;

    const box = await storage.getBox(boxId);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Check user has access to the room
    const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Generate PDF
    const pdfBuffer = await pdfGeneratorService.generatePullSheet(boxId);

    // Track pull sheet generation
    try {
      await storage.createPullSheet({
        boxId: boxId,
        qrImageDriveFileId: null, // Not using Google Drive anymore
        lastGeneratedAt: new Date()
      });
    } catch (error) {
      // Don't fail if tracking fails
      console.warn("Failed to track pull sheet generation:", error);
    }

    // Set response headers for PDF download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="pull-sheet-${box.label.replace(/[^a-zA-Z0-9]/g, '-')}.pdf"`,
      'Content-Length': pdfBuffer.length.toString()
    });

    res.send(pdfBuffer);
  } catch (error) {
    console.error("Failed to generate pull sheet:", error);
    res.status(500).json({ message: "Failed to generate pull sheet" });
  }
});

router.post("/:boxId/generate-pull-sheet", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { boxId } = req.params;

    const box = await storage.getBox(boxId);
    if (!box) {
      return res.status(404).json({ message: "Box not found" });
    }

    // Check user has access to the room
    const hasAccess = await storage.hasRoomAccess(box.roomId, req.session.userId);
    if (!hasAccess) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Track pull sheet generation
    try {
      await storage.createPullSheet({
        boxId: boxId,
        qrImageDriveFileId: null, // Not using Google Drive anymore
        lastGeneratedAt: new Date()
      });
    } catch (error) {
      console.warn("Failed to track pull sheet generation:", error);
    }

    res.json({
      success: true,
      message: "Pull sheet ready for download",
      downloadUrl: `/api/boxes/${boxId}/pull-sheet`
    });
  } catch (error) {
    console.error("Failed to prepare pull sheet:", error);
    res.status(500).json({ message: "Failed to prepare pull sheet" });
  }
});

export default router;