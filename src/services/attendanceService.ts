import prisma from '../utils/prisma';

export class AttendanceService {

  static async finalizeAttendance(liveLectureId: number) {
    console.log(`🔄 Running Attendance Finalization for Lecture ID: ${liveLectureId}`);

    // 1. Get Lecture Details (Start/End Time & Course Info)
    const lecture = await prisma.live_lectures.findUnique({
      where: { live_lecture_id: liveLectureId },
      include: {
        lesson: {
          include: {
            module: { select: { course_id: true } }
          }
        }
      }
    });

    if (!lecture || !lecture.end_time) return;

    // 2. Calculate Total Class Duration (in seconds)
    const classDuration = (new Date(lecture.end_time).getTime() - new Date(lecture.start_time).getTime()) / 1000;
    
    // Safety: If class was < 1 minute, ignore (testing/accidental start)
    if (classDuration < 60) {
        console.log("⚠️ Class too short, skipping attendance.");
        return;
    }

    const presentThreshold = classDuration * 0.75; // 75% Rule

    // 3. Get All Enrolled Students (The "Expected" List)
    const enrolledStudents = await prisma.enrollments.findMany({
      where: { course_id: lecture.lesson.module.course_id },
      select: { user_id: true }
    });

    // 4. Get All Existing Attendance Records (The "Joined" List)
    const existingRecords = await prisma.attendance.findMany({
      where: { live_lecture_id: liveLectureId }
    });
    
    // Map of UserID -> Record
    const joinedUserIds = new Set(existingRecords.map(a => a.user_id));


    // =========================================================
    // A. HANDLE ABSENTEES (Never Joined)
    // =========================================================
    const absentUsers = enrolledStudents
        .filter(student => !joinedUserIds.has(student.user_id))
        .map(student => ({
            live_lecture_id: liveLectureId,
            user_id: student.user_id,
            status: 'absent' as const, // Force type
            duration_seconds: 0
        }));

    if (absentUsers.length > 0) {
        await prisma.attendance.createMany({
            data: absentUsers
        });
        console.log(`❌ Marked ${absentUsers.length} students as Absent (Never Joined).`);
    }

    // =========================================================
    // B. UPDATE STATUS FOR THOSE WHO JOINED (75% Rule)
    // =========================================================
    const updates = existingRecords.map(record => {
        // Determine Status
        const newStatus = record.duration_seconds >= presentThreshold ? 'present' : 'absent';
        
        // Only update if status is different (optimization)
        if (record.status !== newStatus) {
            return prisma.attendance.update({
                where: { attendance_id: record.attendance_id },
                data: { status: newStatus }
            });
        }
        return Promise.resolve();
    });

    await Promise.all(updates);
    console.log(`✅ Attendance Finalized. Threshold: ${Math.round(presentThreshold)}s`);
  }
}