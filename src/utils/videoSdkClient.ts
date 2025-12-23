import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AppError } from './errors';

const VIDEOSDK_API_KEY = process.env.VIDEOSDK_API_KEY;
const VIDEOSDK_SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;
const VIDEOSDK_API_ENDPOINT = 'https://api.videosdk.live/v2';

if (!VIDEOSDK_API_KEY || !VIDEOSDK_SECRET_KEY) {
  console.warn("WARNING: VideoSDK Keys are missing in .env");
}

export const generateVideoSDKToken = (role: 'participant' | 'moderator' = 'participant') => {
  const options = {
    expiresIn: '24h',
    algorithm: 'HS256'
  };

  const payload = {
    apikey: VIDEOSDK_API_KEY,
    permissions: role === 'moderator'
      ? ['allow_join', 'allow_mod', 'allow_publish', 'allow_recording']  // <--- Added allow_publish
      : ['allow_join'],
    version: 2,
    roles: [role]
  };

  // @ts-ignore
  return jwt.sign(payload, VIDEOSDK_SECRET_KEY as string, options);
};

export const createMeetingRoom = async () => {
  try {
    const token = generateVideoSDKToken('moderator');
    const url = `${VIDEOSDK_API_ENDPOINT}/rooms`;
    
    // [FIX] Removed autoStartConfig. We will start recording from Frontend.
    const response = await axios.post(url, {
      name: "Live Class Room",
      customRoomId: null, 
    }, {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      }
    });

    return response.data.roomId; 
  } catch (error) {
    console.error("Error creating VideoSDK Room:", error);
    throw new AppError('Failed to create live classroom', 500);
  }
};

// [NEW] Function to Start Recording with Backblaze Config
export const startMeetingRecording = async (roomId: string) => {
  try {
    const token = generateVideoSDKToken('moderator');
    const url = `${VIDEOSDK_API_ENDPOINT}/recordings/start`;
    const webhookEndpoint = process.env.VIDEOSDK_WEBHOOK_ENDPOINT;

    // Backblaze / AWS Config
    const b2AccessKey = process.env.B2_KEY_ID;       // Ensure this matches your .env
    const b2SecretKey = process.env.B2_APP_KEY;      // Ensure this matches your .env
    const b2Bucket = process.env.B2_BUCKET_NAME;
    const b2Endpoint = process.env.B2_ENDPOINT;      // e.g., s3.us-west-004.backblazeb2.com
    const region = process.env.B2_REGION;

    const response = await axios.post(url, {
      roomId: roomId,
      webhookUrl: webhookEndpoint,
      
      // [CRITICAL] Backblaze Configuration
      awsLayer: {
        accessKeyId: b2AccessKey,
        secretAccessKey: b2SecretKey,
        bucketName: b2Bucket,
        endpoint: b2Endpoint,
        region: region
      },

      // Layout Configuration
      config: {
        layout: {
          type: "SPOTLIGHT",
          priority: "SPEAKER", // Records the active instructor/screen share
          gridSize: 2,
        },
        theme: "DARK",
        mode: "video-and-audio",
        quality: "med", // 720p
        orientation: "landscape",
      }
    }, {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error: any) {
    console.error("Error starting recording:", error?.response?.data || error.message);
    // Don't throw error if recording is already active
    if (error?.response?.data?.msg?.includes("already")) {
        return { status: "ALREADY_STARTED" };
    }
    throw new AppError('Failed to start recording', 500);
  }
};