import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export class WebhookService {
  
  static async handleVideoSdkWebhook(body: any) {
    const { webhookType, data } = body;

    // We only care when a recording stops
    if (webhookType === 'recording-stopped') {
      console.log("📥 Webhook Service: Processing Recording Stopped", data);

      const { filePath, roomId } = data;
      
      // 1. Construct the Backblaze Public URL
      const bucketName = process.env.B2_BUCKET_NAME;
      const region = process.env.B2_REGION; // e.g., us-east-005
      
      if (!bucketName || !region) {
        console.error("❌ Missing Backblaze Config in ENV");
        throw new Error("Server Storage Configuration Missing");
      }

      // Backblaze S3 compatible URL format
      const playbackUrl = `https://${bucketName}.s3.${region}.backblazeb2.com/${filePath}`;

      // 2. Find the Live Lecture by Room ID
      const liveLecture = await prisma.live_lectures.findFirst({
        where: { room_id: roomId },
        include: { lesson: true }
      });

      if (!liveLecture) {
        console.warn(`⚠️ Lecture not found for Room: ${roomId}`);
        // We return false or null to indicate nothing was updated, 
        // but we don't throw an error to avoid retries if it's just invalid data
        return null; 
      }

      // 3. Database Transaction: Update Lesson & Lecture Status
      await prisma.$transaction([
        // A. Update Lesson with the Video URL
        prisma.lessons.update({
          where: { lesson_id: liveLecture.lesson_id },
          data: {
            content_type: 'video', // Switch from 'live' to 'video'
            content_url: playbackUrl,
            duration: data.duration ? Math.round(data.duration / 60) : 0 
          }
        }),
        // B. Mark Lecture as Completed
        prisma.live_lectures.update({
          where: { live_lecture_id: liveLecture.live_lecture_id },
          data: { status: 'completed' }
        })
      ]);

      console.log(`✅ Recording saved for Lesson ID: ${liveLecture.lesson_id}`);
      return { success: true, lessonId: liveLecture.lesson_id };
    }

    return null; // Return null for ignored webhook types
  }
}