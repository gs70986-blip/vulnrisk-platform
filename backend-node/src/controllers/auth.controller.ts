import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await authService.register({ username, email, password });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error registering user:', error);
    res.status(400).json({ error: error.message || 'Failed to register user' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await authService.login({ username, password });

    res.json(result);
  } catch (error: any) {
    console.error('Error logging in:', error);
    res.status(401).json({ error: error.message || 'Failed to login' });
  }
};

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const user = await authService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error: any) {
    console.error('Error getting current user:', error);
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
};








