import prisma from '../utils/prisma';
import { startParticipantRecording } from '../utils/videoSdkClient';
import { AttendanceService } from './attendanceService';

export class WebhookService {
  static async handleVideoSdkWebhook(body: any) {
    const { webhookType, data } = body;

    // Monitor relevant events
    if ([
      'participant-recording-started',
      'participant-recording-stopped',
      'participant-recording-failed',
      'participant-joined',
      'participant-left',
      'session-ended'
    ].includes(webhookType)) {
      console.log(`📥 Webhook Event: ${webhookType}`, data);
    }

    const { roomId, filePath, duration, participantId } = data;
    if (!roomId) return null;

    // FIND THE LECTURE
    const liveLecture = await prisma.live_lectures.findFirst({
      where: { room_id: roomId },
      include: { lesson: true }
    });

    if (!liveLecture) return null;

    // 1. HANDLE PARTICIPANT JOINED (Start Recording if Instructor)
    if (webhookType === 'participant-joined') {
      if (participantId === "instructor") {
        try {
          console.log(`🎙️ Instructor joined. Starting recording for Room: ${roomId}`);
          await startParticipantRecording(roomId, participantId);
        } catch (err) {
          console.error("❌ Error starting participant recording:", err);
        }
      }
      return { success: true };
    }

    // 2. HANDLE PARTICIPANT LEFT (Calculate Attendance)
    if (webhookType === 'participant-left') {
      // Logic: If the ID is a number (student), update attendance
      const userId = Number(participantId);
      
      if (!isNaN(userId)) {
        const seconds = duration ? Math.round(duration) : 0;
        console.log(`📊 Recording attendance for User: ${userId}, Duration: ${seconds}s`);

        await prisma.attendance.upsert({
          where: {
            live_lecture_id_user_id: {
              live_lecture_id: liveLecture.live_lecture_id,
              user_id: userId
            }
          },
          update: {
            duration_seconds: { increment: seconds }
          },
          create: {
            live_lecture_id: liveLecture.live_lecture_id,
            user_id: userId,
            duration_seconds: seconds,
            status: 'absent' // FinalizeAttendance will flip this to 'present' if criteria met
          }
        });
      }
      return { success: true };
    }

    // 3. HANDLE PARTICIPANT RECORDING STOPPED (Save to DB)
    if (webhookType === 'participant-recording-stopped' && filePath) {
      const playbackUrl = this.generatePlaybackUrl(filePath, data.fileUrl);

      // Update Live Lecture status
      const updateLiveLecture = prisma.live_lectures.update({
        where: { live_lecture_id: liveLecture.live_lecture_id },
        data: {
          status: 'completed',
          meeting_url: playbackUrl,
          end_time: new Date()
        }
      });

      // Update Lesson Content only if not already set
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
      console.log(`🎥 Participant Recording saved for Room ${roomId}: ${playbackUrl}`);
      return { success: true };
    }

    // 4. HANDLE SESSION ENDED
    if (webhookType === 'session-ended') {
      await prisma.live_lectures.update({
        where: { live_lecture_id: liveLecture.live_lecture_id },
        data: {
          status: 'completed',
          end_time: new Date()
        }
      });

      // Finalize attendance after a short delay
      setTimeout(() => {
        AttendanceService.finalizeAttendance(liveLecture.live_lecture_id)
          .catch(err => console.error("❌ Attendance Finalization Failed:", err));
      }, 10000);

      return { success: true };
    }

    return null;
  }

  // Helper to construct URLs
  private static generatePlaybackUrl(filePath: string, fallbackUrl: string): string {
    const cdnUrl = process.env.CLOUDFLARE_CDN_URL;
    const bucketName = process.env.B2_BUCKET_NAME;
    const region = process.env.B2_REGION;

    if (cdnUrl) {
      return `${cdnUrl.replace(/\/$/, "")}/${filePath}`;
    } else if (bucketName && region) {
      return `https://${bucketName}.s3.${region}.backblazeb2.com/${filePath}`;
    }
    return fallbackUrl || "";
  }
}