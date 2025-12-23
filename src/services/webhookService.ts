import prisma from '../utils/prisma'; 
import { AttendanceService } from './attendanceService';

export class WebhookService {

  static async handleVideoSdkWebhook(body: any) {
    const { webhookType, data } = body;
    
    // Log important events
    if (['recording-stopped', 'participant-left', 'session-ended'].includes(webhookType)) {
        console.log(`📥 Webhook Received: ${webhookType}`, data);
    }

    const { roomId, filePath, duration, participantId } = data;

    if (!roomId) return null;

    // FIND THE LECTURE
    const liveLecture = await prisma.live_lectures.findFirst({
      where: { room_id: roomId },
      include: { lesson: true }
    });

    if (!liveLecture) {
      // It might be a test room or old room, safe to ignore if not found
      return null;
    }

    // ====================================================
    // CASE 1: RECORDING STOPPED (Save Video)
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
      } else {
         // Fallback if no custom storage is configured (VideoSDK Storage)
         playbackUrl = data.fileUrl || ""; 
      }

      // 2. Update Live Lecture (Fragment)
      const updateLiveLecture = prisma.live_lectures.update({
        where: { live_lecture_id: liveLecture.live_lecture_id },
        data: { 
          status: 'completed',
          meeting_url: playbackUrl, 
          end_time: new Date() 
        }
      });

      // 3. Update Lesson (Main URL) only if empty
      const lessonUpdates = [];
      if (!liveLecture.lesson.content_url || liveLecture.lesson.content_url.trim() === '') {
          lessonUpdates.push(
            prisma.lessons.update({
              where: { lesson_id: liveLecture.lesson_id },
              data: {
                content_type: 'video', 
                content_url: playbackUrl, 
                duration: duration ? Math.round(duration / 60) : 0 
              }
            })
          );
      }

      await prisma.$transaction([updateLiveLecture, ...lessonUpdates]);
      console.log(`🎥 Recording saved for Room ${roomId}`);
      return { success: true };
    }

    // ====================================================
    // CASE: SESSION ENDED (Finalize Attendance)
    // ====================================================
    if (webhookType === 'session-ended') {
      console.log(`🏁 Session Ended for Room: ${roomId}. Finalizing Attendance...`);
      
      if (liveLecture) {
        // 1. Mark Lecture as Completed
        await prisma.live_lectures.update({
          where: { live_lecture_id: liveLecture.live_lecture_id },
          data: { 
            status: 'completed',
            end_time: new Date() 
          }
        });

        // 2. TRIGGER FINALIZATION (With a small delay to catch late 'participant-left' hooks)
        // We don't await this so the webhook response is fast (200 OK)
        setTimeout(() => {
            AttendanceService.finalizeAttendance(liveLecture.live_lecture_id)
                .catch(err => console.error("❌ Attendance Finalization Failed:", err));
        }, 10000); // 10 Second Delay
      }
      return { success: true };
    }

    // ====================================================
    // CASE 3: ATTENDANCE (Participant Left)
    // ====================================================
    if (webhookType === 'participant-left') {
      const seconds = duration ? Math.round(duration) : 0;

      // Ensure participantId is a valid User ID (Number)
      if (participantId && !isNaN(Number(participantId))) {
          await prisma.attendance.upsert({
            where: {
              live_lecture_id_user_id: {
                live_lecture_id: liveLecture.live_lecture_id,
                user_id: Number(participantId)
              }
            },
            update: {
              duration_seconds: { increment: seconds }
            },
            create: {
              live_lecture_id: liveLecture.live_lecture_id,
              user_id: Number(participantId),
              duration_seconds: seconds,
              status: 'absent' 
            }
          });
      }
    }

    return null;
  }
}