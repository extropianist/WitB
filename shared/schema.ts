import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  googleId: text("google_id").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  createdBy: varchar("created_by").references(() => users.id).notNull(),
  driveFolder: text("drive_folder"), // Google Drive folder ID
});

export const boxes = pgTable("boxes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").references(() => rooms.id).notNull(),
  label: text("label").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  driveFolder: text("drive_folder"), // Google Drive folder ID
  qrCode: text("qr_code"), // QR code image file ID
});

export const items = pgTable("items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boxId: varchar("box_id").references(() => boxes.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  quantity: integer("quantity").default(1),
  primaryPhotoFileId: text("primary_photo_file_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const itemPhotos = pgTable("item_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  itemId: varchar("item_id").references(() => items.id).notNull(),
  driveFileId: text("drive_file_id").notNull(),
  webViewLink: text("web_view_link"),
  thumbLink: text("thumb_link"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const memberships = pgTable("memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomId: varchar("room_id").references(() => rooms.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: text("role").notNull(), // "admin" | "viewer"
  createdAt: timestamp("created_at").defaultNow(),
});

export const pullSheets = pgTable("pull_sheets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  boxId: varchar("box_id").references(() => boxes.id).notNull(),
  qrImageDriveFileId: text("qr_image_drive_file_id"),
  lastGeneratedAt: timestamp("last_generated_at").defaultNow(),
});

export const googleTokens = pgTable("google_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiryDate: timestamp("expiry_date"),
  scopes: jsonb("scopes").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const driveFolderCache = pgTable("drive_folder_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  appRootFolderId: text("app_root_folder_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
  driveFolder: true,
});

export const insertBoxSchema = createInsertSchema(boxes).omit({
  id: true,
  createdAt: true,
  driveFolder: true,
  qrCode: true,
});

export const insertItemSchema = createInsertSchema(items).omit({
  id: true,
  createdAt: true,
  primaryPhotoFileId: true,
});

export const insertItemPhotoSchema = createInsertSchema(itemPhotos).omit({
  id: true,
  createdAt: true,
});

export const insertMembershipSchema = createInsertSchema(memberships).omit({
  id: true,
  createdAt: true,
});

export const insertGoogleTokensSchema = createInsertSchema(googleTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDriveFolderCacheSchema = createInsertSchema(driveFolderCache).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

export type Box = typeof boxes.$inferSelect;
export type InsertBox = z.infer<typeof insertBoxSchema>;

export type Item = typeof items.$inferSelect;
export type InsertItem = z.infer<typeof insertItemSchema>;

export type ItemPhoto = typeof itemPhotos.$inferSelect;
export type InsertItemPhoto = z.infer<typeof insertItemPhotoSchema>;

export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = z.infer<typeof insertMembershipSchema>;

export type PullSheet = typeof pullSheets.$inferSelect;

export type GoogleTokens = typeof googleTokens.$inferSelect;
export type InsertGoogleTokens = z.infer<typeof insertGoogleTokensSchema>;

export type DriveFolderCache = typeof driveFolderCache.$inferSelect;
export type InsertDriveFolderCache = z.infer<typeof insertDriveFolderCacheSchema>;

// Extended types with relations
export type RoomWithStats = Room & {
  boxCount: number;
  itemCount: number;
  memberCount: number;
  userRole: string;
};

export type BoxWithStats = Box & {
  itemCount: number;
};

export type ItemWithPhotos = Item & {
  photos: ItemPhoto[];
  photoCount: number;
};
