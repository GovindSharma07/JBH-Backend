import { Request, Response } from 'express';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export class JobController {
  static runCleanup = async (req: Request, res: Response) => {
    try {
      // 1. Security Check: Prevent random people from clearing your DB
      const authHeader = req.headers['authorization'];
      const secret = process.env.CRON_SECRET; 

      if (!secret || authHeader !== `Bearer ${secret}`) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // 2. The Logic (formerly in cleanup.ts)
      console.log('🧹 Running cleanup job via API...');
      const now = new Date();
      
      const deleted = await prisma.verification_tokens.deleteMany({
        where: { expires_at: { lt: now } },
      });

      console.log(`✅ Deleted ${deleted.count} expired tokens.`);
      
      return res.status(200).json({ 
        success: true, 
        message: `Deleted ${deleted.count} tokens` 
      });

    } catch (error) {
      console.error('❌ Error cleaning up tokens:', error);
      return res.status(500).json({ error: 'Cleanup failed' });
    }
  };
}