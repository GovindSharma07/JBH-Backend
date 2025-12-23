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
  // @ts-ignore
  return jwt.sign(payload, VIDEOSDK_SECRET_KEY as string, options);
};

// 1. Create Room (No Auto-Start)
export const createMeetingRoom = async () => {
  try {
    const token = generateVideoSDKToken('moderator');
    const response = await axios.post(`${VIDEOSDK_API_ENDPOINT}/rooms`, {
      name: "Live Class Room"
    }, {
      headers: { Authorization: token }
    });
    return response.data.roomId;
  } catch (error) {
    throw new AppError('Failed to create room', 500);
  }
};

// 2. Start Recording (Instructor Only Mode)
export const startMeetingRecording = async (roomId: string, instructorId: string) => {
  try {
    const token = generateVideoSDKToken('moderator');
    
    // Step A: Start Recording
    // Layout "SPOTLIGHT" with priority "PIN" means "Record whoever is pinned"
    await axios.post(`${VIDEOSDK_API_ENDPOINT}/recordings/start`, {
      roomId: roomId,
      webhookUrl: process.env.VIDEOSDK_WEBHOOK_ENDPOINT,
      awsLayer: {
        accessKeyId: process.env.B2_KEY_ID,
        secretAccessKey: process.env.B2_APP_KEY,
        bucketName: process.env.B2_BUCKET_NAME,
        endpoint: process.env.B2_ENDPOINT,
        region: process.env.B2_REGION || 'us-east-1'
      },
      config: {
        layout: {
          type: "SPOTLIGHT",
          priority: "PIN", 
          gridSize: 2,
        },
        theme: "DARK",
        mode: "video-and-audio",
        quality: "med",
        orientation: "landscape",
      }
    }, { headers: { Authorization: token } });

    // Step B: GLOBALLY PIN the Instructor
    // This forces the Recorder to look at the Instructor
    // Note: We wait 1s to ensure the recording bot has joined, or fire-and-forget
    setTimeout(async () => {
        try {
            await axios.post(`${VIDEOSDK_API_ENDPOINT}/sessions/${roomId}/participants/${instructorId}/pin`, {
                "state": { "cam": true, "share": true } // Pin both Camera and Screen Share
            }, { headers: { Authorization: token } });
            console.log(`📌 Instructor ${instructorId} pinned for recording.`);
        } catch (e) {
            console.error("Failed to pin instructor:", e);
        }
    }, 2000);

    return { success: true };
  } catch (error: any) {
    // Ignore if already running
    if (error?.response?.data?.msg?.includes("already")) return { status: "ALREADY_STARTED" };
    console.error("Recording Error:", error.response?.data);
    throw new AppError('Failed to start recording', 500);
  }
};