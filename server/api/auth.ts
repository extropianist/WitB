import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { localUserService } from "../db/localdb.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// Schema for authentication requests
const authSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

// Local Authentication routes
router.post("/register", authLimiter, async (req, res) => {
  try {
    const { username, password } = authSchema.parse(req.body);

    const user = await localUserService.createUser(username, password);

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
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Registration error:", error);
    if (error instanceof Error) {
      res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: "Registration failed" });
    }
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { username, password } = authSchema.parse(req.body);

    const user = await localUserService.authenticateUser(username, password);
    if (!user) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

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
    if (error instanceof z.ZodError) {
      const validationError = fromZodError(error);
      return res.status(400).json({ message: validationError.toString() });
    }
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction failed:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: "Logout successful" });
  });
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const user = await localUserService.getUserById(req.session.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ id: user.id, username: user.username });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({ message: "Failed to get user information" });
  }
});

export default router;