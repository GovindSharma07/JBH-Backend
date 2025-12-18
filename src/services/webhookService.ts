import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

export class WebhookService {
  
  static async handleVideoSdkWebhook(body: any) {
    const { webhookType, data } = body;

    // --- CASE 1: Recording Stopped (Class is Over) ---
    if (webhookType === 'recording-stopped') {
      console.log("📥 Webhook: Recording Stopped", data);

      const { filePath, roomId, duration } = data; // duration is in seconds

      // 1. Validation
      if (!filePath || !roomId) {
        console.warn("⚠️ Invalid Webhook Data: Missing filePath or roomId");
        return null;
      }
      
      // 2. Construct the Playback URL
      // We prioritize your Cloudflare CDN if configured in .env, otherwise fallback to Backblaze S3
      const cdnUrl = process.env.CLOUDFLARE_CDN_URL;
      const bucketName = process.env.B2_BUCKET_NAME;
      const region = process.env.B2_REGION; // e.g., us-east-005
      
      let playbackUrl = '';

      if (cdnUrl) {
         // Remove trailing slash from CDN URL if present to avoid double slashes
         const cleanCdn = cdnUrl.replace(/\/$/, "");
         playbackUrl = `${cleanCdn}/${filePath}`;
      } else if (bucketName && region) {
         // Fallback to direct Backblaze S3 Link (Virtual-Host Style)
         playbackUrl = `https://${bucketName}.s3.${region}.backblazeb2.com/${filePath}`;
      } else {
        console.error("❌ Missing Storage Config (CDN or B2)");
        // We log error but return null so VideoSDK doesn't retry indefinitely
        return null; 
      }

      // 3. Find the Live Lecture
      const liveLecture = await prisma.live_lectures.findFirst({
        where: { room_id: roomId },
        include: { lesson: true }
      });

      if (!liveLecture) {
        console.warn(`⚠️ Lecture not found for Room: ${roomId}`);
        return null; 
      }

      // 4. Database Update (Transaction)
      // Updates the lesson to be a video and marks the live session as completed
      await prisma.$transaction([
        // A. Update Lesson (Content for Students)
        prisma.lessons.update({
          where: { lesson_id: liveLecture.lesson_id },
          data: {
            content_type: 'video', // Switches UI from "Join Live" to "Watch Video"
            content_url: playbackUrl,
            // Convert seconds to minutes, default to 0 if missing
            duration: duration ? Math.round(duration / 60) : 0 
          }
        }),
        // B. Update Live Lecture (Admin Status)
        prisma.live_lectures.update({
          where: { live_lecture_id: liveLecture.live_lecture_id },
          data: { 
            status: 'completed',
            meeting_url: playbackUrl, // Store recording link here too
            end_time: new Date() // Set the actual finish time
          }
        })
      ]);

      console.log(`✅ Recording saved for Lesson ${liveLecture.lesson_id}: ${playbackUrl}`);
      return { success: true, lessonId: liveLecture.lesson_id };
    }

    return null; // Ignore other webhook types
  }
}