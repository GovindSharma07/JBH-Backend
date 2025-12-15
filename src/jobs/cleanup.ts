import cron from 'node-cron';
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

// Schedule task to run every hour (0 * * * *)
export const startCleanupJob = () => {
  cron.schedule('0 3 * * *', async () => {
    console.log('🧹 Running cleanup job for expired tokens...');
    
    try {
      const now = new Date();
      
      const deleted = await prisma.verification_tokens.deleteMany({
        where: {
          expires_at: {
            lt: now, // Delete where expiration time is Less Than (lt) now
          },
        },
      });

      if (deleted.count > 0) {
        console.log(`✅ Deleted ${deleted.count} expired tokens.`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up tokens:', error);
    }
  });
};