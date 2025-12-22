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
    if (webhookType === 'recording-stopped' && filePath) {
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

      await prisma.$transaction([
        prisma.lessons.update({
          where: { lesson_id: liveLecture.lesson_id },
          data: {
            content_type: 'video',
            content_url: playbackUrl,
            duration: duration ? Math.round(duration / 60) : 0
          }
        }),
        prisma.live_lectures.update({
          where: { live_lecture_id: liveLecture.live_lecture_id },
          data: {
            status: 'completed',
            meeting_url: playbackUrl,
            end_time: new Date()
          }
        })
      ]);
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