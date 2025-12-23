import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AppError } from './errors';

const VIDEOSDK_API_KEY = process.env.VIDEOSDK_API_KEY;
const VIDEOSDK_SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;
const VIDEOSDK_API_ENDPOINT = 'https://api.videosdk.live/v2';

export const generateVideoSDKToken = (role: 'participant' | 'moderator' = 'participant') => {
  const options = { expiresIn: '24h', algorithm: 'HS256' };
  const payload = {
    apikey: VIDEOSDK_API_KEY,
    permissions: role === 'moderator'
      ? ['allow_join', 'allow_mod', 'allow_publish', 'allow_recording']
      : ['allow_join'],
    version: 2,
    roles: [role]
  };

  console.log("Generating VideoSDK Token with payload:", payload);
  // @ts-ignore
  return jwt.sign(payload, VIDEOSDK_SECRET_KEY as string, options);
};

// 1. Create Room (No Auto-Start)
export const createMeetingRoom = async () => {
  try {
    const token = generateVideoSDKToken('moderator');
    const response = await axios.post(`${VIDEOSDK_API_ENDPOINT}/rooms`, {
      name: "Live Class Room",
      webhook: {
        url: "https://jbh-backend.onrender.com/api/webhook/videosdk",
        events: [
          "session-started", 
          "session-ended", 
          "participant-joined", 
          "participant-left",
          "recording-started",
          "recording-stopped",
          "recording-failed"
        ]
      }
    }, {
      headers: { Authorization: token }
    });
    console.log("Created VideoSDK Room:", response.data);
    return response.data.roomId;
  } catch (error) {
    console.error("Error creating VideoSDK room:", error);
    throw new AppError('Failed to create room', 500);
  }
};
// 1. Helper to get Active Session ID
const getActiveSessionId = async (roomId: string) => {
  const token = generateVideoSDKToken('moderator');
  const response = await axios.get(`${VIDEOSDK_API_ENDPOINT}/sessions?roomId=${roomId}&status=active`, {
    headers: { Authorization: token }
  });
  console.log("Active Sessions Response:", response.data);
  return response.data.data?.[0]?.id; // Returns the current session ID
};

export const startMeetingRecording = async (roomId: string, instructorId: string) => {
  try {
    const token = generateVideoSDKToken('moderator');

    // A. Start Recording with Spotlight/Pin Layout
    await axios.post(`${VIDEOSDK_API_ENDPOINT}/recordings/start`, {
      roomId,
      webhookUrl: "https://jbh-backend.onrender.com/api/webhook/videosdk",
      awsLayer: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY,
        bucketName: process.env.B2_BUCKET_NAME,
        endpoint: process.env.B2_ENDPOINT,
        region: process.env.B2_REGION
      },
      config: {
        layout: { type: "SPOTLIGHT", priority: "PIN", gridSize: 1 },
        theme: "DARK",
        mode: "video-and-audio",
        quality: "med",
      }
    }, { headers: { Authorization: token } });

    console.log(`🎬 Recording started for Room ${roomId}`);

    // B. GLOBALLY PIN the Instructor (Must use SESSION ID)
    // Add a delay to ensure the recording bot has joined the session
    setTimeout(async () => {
      try {
        const sessionId = await getActiveSessionId(roomId);
        if (sessionId) {
          await axios.post(`${VIDEOSDK_API_ENDPOINT}/sessions/${sessionId}/participants/${instructorId}/pin`, {
            "state": { "cam": true, "share": true }
          }, { headers: { Authorization: token } });
          console.log(`📌 Instructor ${instructorId} pinned globally in session ${sessionId}`);
        }
      } catch (e) {
        console.error("Failed to pin instructor globally:", e);
      }
    }, 5000); // 5s delay is safer for the bot to join
    console.log(`Recording initiation process completed for Room ${roomId}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error starting recording:", error.response?.data || error.message);
    if (error?.response?.data?.msg?.includes("already")) return { status: "ALREADY_STARTED" };
    throw new AppError('Failed to start recording', 500);
  }
};