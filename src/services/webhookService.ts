import prisma from '../utils/prisma'; // Use Singleton

export class WebhookService {

  static async handleVideoSdkWebhook(body: any) {
    const { webhookType, data } = body;
    console.log(`📥 Webhook Received: ${webhookType}`, data);

    const { roomId, filePath, duration } = data;

    if (!roomId) return null;

    // FIND THE LECTURE
    const liveLecture = await prisma.live_lectures.findFirst({
      where: { room_id: roomId },
      include: { lesson: true }
    });

    if (!liveLecture) {
      console.warn(`⚠️ Lecture not found for Room: ${roomId}`);
      return null;
    }

    // CASE 1: Recording Success
   // ====================================================
    // CASE: RECORDING STOPPED (Save Video)
    // ====================================================
    if (webhookType === 'recording-stopped' && filePath) {
      // 1. Construct the Playback URL
      const cdnUrl = process.env.CLOUDFLARE_CDN_URL;
      const bucketName = process.env.B2_BUCKET_NAME;
      const region = process.env.B2_REGION;
      
      let playbackUrl = '';
      if (cdnUrl) {
         const cleanCdn = cdnUrl.replace(/\/$/, "");
         playbackUrl = `${cleanCdn}/${filePath}`;
      } else if (bucketName && region) {
         playbackUrl = `https://${bucketName}.s3.${region}.backblazeb2.com/${filePath}`;
      }

      // 2. Prepare Database Updates
      // We always update the specific Live Lecture row (Fragment)
      const updateLiveLecture = prisma.live_lectures.update({
        where: { live_lecture_id: liveLecture.live_lecture_id },
        data: { 
          status: 'completed',
          meeting_url: playbackUrl, 
          end_time: new Date() 
        }
      });

      // 3. Conditional Update for the Parent Lesson
      // We only update the Lesson's main URL if it is currently EMPTY.
      // This ensures the "Main" button always plays Part 1, while the playlist (in Flutter) handles the rest.
      const lessonUpdates = [];
      
      // Check if the parent lesson already has a video URL
      if (!liveLecture.lesson.content_url || liveLecture.lesson.content_url.trim() === '') {
          lessonUpdates.push(
            prisma.lessons.update({
              where: { lesson_id: liveLecture.lesson_id },
              data: {
                content_type: 'video', 
                content_url: playbackUrl, // Set as main URL
                duration: duration ? Math.round(duration / 60) : 0 
              }
            })
          );
      }

      // 4. Execute Transaction
      await prisma.$transaction([
          updateLiveLecture,
          ...lessonUpdates
      ]);

      console.log(`🎥 Recording saved for Room ${roomId}. Lesson Main URL updated: ${lessonUpdates.length > 0}`);
      return { success: true };
    }

    // [NEW] CASE 2: Recording Failed (Or Session Ended without Recording)
    if (webhookType === 'session-ended' || webhookType === 'recording-failed') {
      // If the class is still marked 'live', force close it so it doesn't show as active
      if (liveLecture.status === 'live') {
        await prisma.live_lectures.update({
          where: { live_lecture_id: liveLecture.live_lecture_id },
          data: {
            status: 'completed',
            end_time: new Date()
          }
        });
        console.log(`⚠️ Session ended (no recording), marked as completed: ${roomId}`);
      }
    }

    // Inside handleVideoSdkWebhook
    if (webhookType === 'participant-left') {
      const { duration, data: { participantId } } = body; // Adjust based on actual payload

      // VideoSDK returns duration in seconds
      const seconds = Math.round(duration);

      // Update the DB
      await prisma.attendance.upsert({
        where: {
          live_lecture_id_user_id: {
            live_lecture_id: liveLecture.live_lecture_id,
            user_id: Number(participantId) // Ensure this is a number
          }
        },
        update: {
          // Increment duration in case they joined/left multiple times
          duration_seconds: { increment: seconds }
        },
        create: {
          live_lecture_id: liveLecture.live_lecture_id,
          user_id: Number(participantId),
          duration_seconds: seconds,
          status: 'absent' // Default is absent until calculation
        }
      });
    }

    return null;
  }
}