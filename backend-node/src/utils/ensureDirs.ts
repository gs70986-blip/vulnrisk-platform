import fs from 'fs/promises';
import path from 'path';

export async function ensureDirectories() {
  const dirs = [
    '/app/uploads',
    '/app/data',
    '/app/models',
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, which is fine
      console.log(`Directory ${dir} ready`);
    }
  }
}

















