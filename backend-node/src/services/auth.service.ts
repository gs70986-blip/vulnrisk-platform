import prisma from '../db';
import bcrypt from 'bcrypt';
import jwt, { SignOptions } from 'jsonwebtoken';
import { config } from '../config';

export interface RegisterInput {
  username: string;
  email?: string;
  password: string;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    username: string;
    email: string | null;
    role: string;
  };
  token: string;
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Check if email already exists (if provided)
    if (input.email) {
      const existingEmail = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (existingEmail) {
        throw new Error('Email already exists');
      }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email || null,
        password: hashedPassword,
        role: 'user', // Default role
      },
    });

    // Generate JWT token
    const token = this.generateToken(user.id, user.username, user.role);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    // Find user by username
    const user = await prisma.user.findUnique({
      where: { username: input.username },
    });

    if (!user) {
      throw new Error('Invalid username or password');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(input.password, user.password);

    if (!isValidPassword) {
      throw new Error('Invalid username or password');
    }

    // Generate JWT token
    const token = this.generateToken(user.id, user.username, user.role);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
      token,
    };
  }

  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }

  private generateToken(userId: string, username: string, role: string): string {
    const payload = { userId, username, role };
    const secret: string = String(config.jwtSecret);
    // Use type assertion to satisfy jsonwebtoken type definitions
    const options: SignOptions = {
      expiresIn: String(config.jwtExpiresIn) as any,
    };
    return jwt.sign(payload, secret, options);
  }

  verifyToken(token: string): { userId: string; username: string; role: string } {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as {
        userId: string;
        username: string;
        role: string;
      };
      return decoded;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }
}








