import { Low } from 'lowdb';
import { JSONFileSync } from 'lowdb/node';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt';

export interface LocalUser {
  id: string;
  username: string;
  hashedPassword: string;
  createdAt: Date;
}

interface DatabaseData {
  users: LocalUser[];
}

// Initialize the database
const adapter = new JSONFileSync<DatabaseData>('server/db/users.json');
const db = new Low<DatabaseData>(adapter, { users: [] });

class LocalUserService {
  private saltRounds = 12;

  async init() {
    await db.read();
    if (!db.data) {
      db.data = { users: [] };
      await db.write();
    }
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  async createUser(username: string, password: string): Promise<LocalUser> {
    await db.read();
    
    // Check if username already exists
    const existingUser = db.data!.users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Validate username and password
    if (username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const hashedPassword = await this.hashPassword(password);
    const user: LocalUser = {
      id: randomUUID(),
      username: username.trim(),
      hashedPassword,
      createdAt: new Date()
    };

    db.data!.users.push(user);
    await db.write();

    return user;
  }

  async authenticateUser(username: string, password: string): Promise<LocalUser | null> {
    await db.read();
    
    const user = db.data!.users.find(user => user.username.toLowerCase() === username.toLowerCase());
    if (!user) {
      return null;
    }

    const isValidPassword = await this.comparePassword(password, user.hashedPassword);
    if (!isValidPassword) {
      return null;
    }

    return user;
  }

  async getUserById(id: string): Promise<LocalUser | null> {
    await db.read();
    return db.data!.users.find(user => user.id === id) || null;
  }

  async getUserByUsername(username: string): Promise<LocalUser | null> {
    await db.read();
    return db.data!.users.find(user => user.username.toLowerCase() === username.toLowerCase()) || null;
  }

  async getAllUsers(): Promise<LocalUser[]> {
    await db.read();
    return db.data!.users;
  }
}

export const localUserService = new LocalUserService();