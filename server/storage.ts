import { 
  type User, 
  type InsertUser, 
  type Room, 
  type InsertRoom,
  type Box,
  type InsertBox,
  type Item,
  type InsertItem,
  type ItemPhoto,
  type InsertItemPhoto,
  type Membership,
  type InsertMembership,
  type RoomWithStats,
  type BoxWithStats,
  type ItemWithPhotos,
  users,
  rooms,
  boxes,
  items,
  itemPhotos,
  memberships
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, count } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Rooms
  getRoomsByUser(userId: string): Promise<RoomWithStats[]>;
  getRoom(roomId: string): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(roomId: string): Promise<boolean>;

  // Boxes
  getBoxesByRoom(roomId: string): Promise<BoxWithStats[]>;
  getBox(boxId: string): Promise<Box | undefined>;
  createBox(box: InsertBox): Promise<Box>;
  updateBox(boxId: string, updates: Partial<Box>): Promise<Box | undefined>;
  deleteBox(boxId: string): Promise<boolean>;

  // Items
  getItemsByBox(boxId: string): Promise<ItemWithPhotos[]>;
  getItem(itemId: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(itemId: string, updates: Partial<Item>): Promise<Item | undefined>;
  deleteItem(itemId: string): Promise<boolean>;

  // Item Photos
  getItemPhotos(itemId: string): Promise<ItemPhoto[]>;
  addItemPhoto(photo: InsertItemPhoto): Promise<ItemPhoto>;
  deleteItemPhoto(photoId: string): Promise<boolean>;

  // Memberships
  getMembership(roomId: string, userId: string): Promise<Membership | undefined>;
  createMembership(membership: InsertMembership): Promise<Membership>;
  updateMembership(roomId: string, userId: string, role: string): Promise<Membership | undefined>;
  deleteMembership(roomId: string, userId: string): Promise<boolean>;
  getRoomMembers(roomId: string): Promise<(Membership & { user: User })[]>;

  // Access Control
  hasRoomAccess(roomId: string, userId: string): Promise<boolean>;
  isRoomAdmin(roomId: string, userId: string): Promise<boolean>;
}

// Database implementation using Drizzle ORM
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Room methods
  async getRoomsByUser(userId: string): Promise<RoomWithStats[]> {
    // Get all memberships for the user
    const userMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId));

    const roomIds = userMemberships.map(m => m.roomId);
    if (roomIds.length === 0) return [];

    // Get rooms with stats
    const roomsWithStats: RoomWithStats[] = [];
    
    for (const membership of userMemberships) {
      const [room] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, membership.roomId));
      
      if (!room) continue;

      // Count boxes in room
      const [boxResult] = await db
        .select({ count: count() })
        .from(boxes)
        .where(eq(boxes.roomId, room.id));
      
      // Count items in room boxes
      const roomBoxes = await db
        .select({ id: boxes.id })
        .from(boxes)
        .where(eq(boxes.roomId, room.id));
      
      let itemCount = 0;
      for (const box of roomBoxes) {
        const [itemResult] = await db
          .select({ count: count() })
          .from(items)
          .where(eq(items.boxId, box.id));
        itemCount += itemResult.count;
      }

      // Count members in room
      const [memberResult] = await db
        .select({ count: count() })
        .from(memberships)
        .where(eq(memberships.roomId, room.id));

      roomsWithStats.push({
        ...room,
        boxCount: boxResult.count,
        itemCount,
        memberCount: memberResult.count,
        userRole: membership.role
      });
    }

    return roomsWithStats;
  }

  async getRoom(roomId: string): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, roomId));
    return room || undefined;
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const [room] = await db.insert(rooms).values(insertRoom).returning();
    return room;
  }

  async updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | undefined> {
    const [room] = await db
      .update(rooms)
      .set(updates)
      .where(eq(rooms.id, roomId))
      .returning();
    return room || undefined;
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const result = await db.delete(rooms).where(eq(rooms.id, roomId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Box methods
  async getBoxesByRoom(roomId: string): Promise<BoxWithStats[]> {
    const roomBoxes = await db.select().from(boxes).where(eq(boxes.roomId, roomId));
    
    const boxesWithStats: BoxWithStats[] = [];
    for (const box of roomBoxes) {
      const [itemResult] = await db
        .select({ count: count() })
        .from(items)
        .where(eq(items.boxId, box.id));
      
      boxesWithStats.push({
        ...box,
        itemCount: itemResult.count
      });
    }
    
    return boxesWithStats;
  }

  async getBox(boxId: string): Promise<Box | undefined> {
    const [box] = await db.select().from(boxes).where(eq(boxes.id, boxId));
    return box || undefined;
  }

  async createBox(insertBox: InsertBox): Promise<Box> {
    const [box] = await db.insert(boxes).values(insertBox).returning();
    return box;
  }

  async updateBox(boxId: string, updates: Partial<Box>): Promise<Box | undefined> {
    const [box] = await db
      .update(boxes)
      .set(updates)
      .where(eq(boxes.id, boxId))
      .returning();
    return box || undefined;
  }

  async deleteBox(boxId: string): Promise<boolean> {
    const result = await db.delete(boxes).where(eq(boxes.id, boxId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Item methods
  async getItemsByBox(boxId: string): Promise<ItemWithPhotos[]> {
    const boxItems = await db.select().from(items).where(eq(items.boxId, boxId));
    
    const itemsWithPhotos: ItemWithPhotos[] = [];
    for (const item of boxItems) {
      const photos = await db
        .select()
        .from(itemPhotos)
        .where(eq(itemPhotos.itemId, item.id));
      
      itemsWithPhotos.push({
        ...item,
        photos,
        photoCount: photos.length
      });
    }
    
    return itemsWithPhotos;
  }

  async getItem(itemId: string): Promise<Item | undefined> {
    const [item] = await db.select().from(items).where(eq(items.id, itemId));
    return item || undefined;
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const [item] = await db.insert(items).values(insertItem).returning();
    return item;
  }

  async updateItem(itemId: string, updates: Partial<Item>): Promise<Item | undefined> {
    const [item] = await db
      .update(items)
      .set(updates)
      .where(eq(items.id, itemId))
      .returning();
    return item || undefined;
  }

  async deleteItem(itemId: string): Promise<boolean> {
    const result = await db.delete(items).where(eq(items.id, itemId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Item Photo methods
  async getItemPhotos(itemId: string): Promise<ItemPhoto[]> {
    return await db.select().from(itemPhotos).where(eq(itemPhotos.itemId, itemId));
  }

  async addItemPhoto(insertPhoto: InsertItemPhoto): Promise<ItemPhoto> {
    const [photo] = await db.insert(itemPhotos).values(insertPhoto).returning();
    return photo;
  }

  async deleteItemPhoto(photoId: string): Promise<boolean> {
    const result = await db.delete(itemPhotos).where(eq(itemPhotos.id, photoId));
    return result.rowCount !== null && result.rowCount > 0;
  }

  // Membership methods
  async getMembership(roomId: string, userId: string): Promise<Membership | undefined> {
    const [membership] = await db
      .select()
      .from(memberships)
      .where(and(eq(memberships.roomId, roomId), eq(memberships.userId, userId)));
    return membership || undefined;
  }

  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const [membership] = await db.insert(memberships).values(insertMembership).returning();
    return membership;
  }

  async updateMembership(roomId: string, userId: string, role: string): Promise<Membership | undefined> {
    const [membership] = await db
      .update(memberships)
      .set({ role })
      .where(and(eq(memberships.roomId, roomId), eq(memberships.userId, userId)))
      .returning();
    return membership || undefined;
  }

  async deleteMembership(roomId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(memberships)
      .where(and(eq(memberships.roomId, roomId), eq(memberships.userId, userId)));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getRoomMembers(roomId: string): Promise<(Membership & { user: User })[]> {
    const roomMemberships = await db
      .select()
      .from(memberships)
      .where(eq(memberships.roomId, roomId));
    
    const membersWithUsers: (Membership & { user: User })[] = [];
    for (const membership of roomMemberships) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, membership.userId));
      
      if (user) {
        membersWithUsers.push({ ...membership, user });
      }
    }
    
    return membersWithUsers;
  }

  // Access Control methods
  async hasRoomAccess(roomId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(roomId, userId);
    return !!membership;
  }

  async isRoomAdmin(roomId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(roomId, userId);
    return membership?.role === "admin";
  }
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private rooms: Map<string, Room> = new Map();
  private boxes: Map<string, Box> = new Map();
  private items: Map<string, Item> = new Map();
  private itemPhotos: Map<string, ItemPhoto> = new Map();
  private memberships: Map<string, Membership> = new Map();

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByGoogleId(googleId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.googleId === googleId);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      ...insertUser, 
      id,
      profileImage: insertUser.profileImage || null,
      createdAt: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async getRoomsByUser(userId: string): Promise<RoomWithStats[]> {
    const userMemberships = Array.from(this.memberships.values())
      .filter(m => m.userId === userId);
    
    const rooms: RoomWithStats[] = [];
    
    for (const membership of userMemberships) {
      const room = this.rooms.get(membership.roomId);
      if (!room) continue;

      const roomBoxes = Array.from(this.boxes.values())
        .filter(b => b.roomId === room.id);
      
      const boxCount = roomBoxes.length;
      const itemCount = roomBoxes.reduce((total, box) => {
        return total + Array.from(this.items.values())
          .filter(i => i.boxId === box.id).length;
      }, 0);

      const memberCount = Array.from(this.memberships.values())
        .filter(m => m.roomId === room.id).length;

      rooms.push({
        ...room,
        boxCount,
        itemCount,
        memberCount,
        userRole: membership.role
      });
    }

    return rooms;
  }

  async getRoom(roomId: string): Promise<Room | undefined> {
    return this.rooms.get(roomId);
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const id = randomUUID();
    const room: Room = { 
      ...insertRoom, 
      id,
      description: insertRoom.description || null,
      createdAt: new Date(),
      driveFolder: null
    };
    this.rooms.set(id, room);
    return room;
  }

  async updateRoom(roomId: string, updates: Partial<Room>): Promise<Room | undefined> {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    
    const updatedRoom = { ...room, ...updates };
    this.rooms.set(roomId, updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    return this.rooms.delete(roomId);
  }

  async getBoxesByRoom(roomId: string): Promise<BoxWithStats[]> {
    const roomBoxes = Array.from(this.boxes.values())
      .filter(b => b.roomId === roomId);

    return roomBoxes.map(box => ({
      ...box,
      itemCount: Array.from(this.items.values())
        .filter(i => i.boxId === box.id).length
    }));
  }

  async getBox(boxId: string): Promise<Box | undefined> {
    return this.boxes.get(boxId);
  }

  async createBox(insertBox: InsertBox): Promise<Box> {
    const id = randomUUID();
    const box: Box = { 
      ...insertBox, 
      id,
      notes: insertBox.notes || null,
      createdAt: new Date(),
      driveFolder: null,
      qrCode: null
    };
    this.boxes.set(id, box);
    return box;
  }

  async updateBox(boxId: string, updates: Partial<Box>): Promise<Box | undefined> {
    const box = this.boxes.get(boxId);
    if (!box) return undefined;
    
    const updatedBox = { ...box, ...updates };
    this.boxes.set(boxId, updatedBox);
    return updatedBox;
  }

  async deleteBox(boxId: string): Promise<boolean> {
    return this.boxes.delete(boxId);
  }

  async getItemsByBox(boxId: string): Promise<ItemWithPhotos[]> {
    const boxItems = Array.from(this.items.values())
      .filter(i => i.boxId === boxId);

    return boxItems.map(item => {
      const photos = Array.from(this.itemPhotos.values())
        .filter(p => p.itemId === item.id);
      
      return {
        ...item,
        photos,
        photoCount: photos.length
      };
    });
  }

  async getItem(itemId: string): Promise<Item | undefined> {
    return this.items.get(itemId);
  }

  async createItem(insertItem: InsertItem): Promise<Item> {
    const id = randomUUID();
    const item: Item = { 
      ...insertItem, 
      id,
      description: insertItem.description || null,
      quantity: insertItem.quantity || 1,
      createdAt: new Date(),
      primaryPhotoFileId: null
    };
    this.items.set(id, item);
    return item;
  }

  async updateItem(itemId: string, updates: Partial<Item>): Promise<Item | undefined> {
    const item = this.items.get(itemId);
    if (!item) return undefined;
    
    const updatedItem = { ...item, ...updates };
    this.items.set(itemId, updatedItem);
    return updatedItem;
  }

  async deleteItem(itemId: string): Promise<boolean> {
    return this.items.delete(itemId);
  }

  async getItemPhotos(itemId: string): Promise<ItemPhoto[]> {
    return Array.from(this.itemPhotos.values())
      .filter(p => p.itemId === itemId);
  }

  async addItemPhoto(insertPhoto: InsertItemPhoto): Promise<ItemPhoto> {
    const id = randomUUID();
    const photo: ItemPhoto = { 
      ...insertPhoto, 
      id,
      webViewLink: insertPhoto.webViewLink || null,
      thumbLink: insertPhoto.thumbLink || null,
      createdAt: new Date()
    };
    this.itemPhotos.set(id, photo);
    return photo;
  }

  async deleteItemPhoto(photoId: string): Promise<boolean> {
    return this.itemPhotos.delete(photoId);
  }

  async getMembership(roomId: string, userId: string): Promise<Membership | undefined> {
    return Array.from(this.memberships.values())
      .find(m => m.roomId === roomId && m.userId === userId);
  }

  async createMembership(insertMembership: InsertMembership): Promise<Membership> {
    const id = randomUUID();
    const membership: Membership = { 
      ...insertMembership, 
      id,
      createdAt: new Date()
    };
    this.memberships.set(id, membership);
    return membership;
  }

  async updateMembership(roomId: string, userId: string, role: string): Promise<Membership | undefined> {
    const membership = await this.getMembership(roomId, userId);
    if (!membership) return undefined;
    
    const updatedMembership = { ...membership, role };
    this.memberships.set(membership.id, updatedMembership);
    return updatedMembership;
  }

  async deleteMembership(roomId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(roomId, userId);
    if (!membership) return false;
    
    return this.memberships.delete(membership.id);
  }

  async getRoomMembers(roomId: string): Promise<(Membership & { user: User })[]> {
    const roomMemberships = Array.from(this.memberships.values())
      .filter(m => m.roomId === roomId);

    return roomMemberships.map(membership => {
      const user = this.users.get(membership.userId);
      return { ...membership, user: user! };
    }).filter(m => m.user);
  }

  async hasRoomAccess(roomId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(roomId, userId);
    return !!membership;
  }

  async isRoomAdmin(roomId: string, userId: string): Promise<boolean> {
    const membership = await this.getMembership(roomId, userId);
    return membership?.role === "admin";
  }
}

export const storage = new DatabaseStorage();
