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
};;

export const createMeetingRoom = async () => {
  try {
    const webhookEndpoint = process.env.VIDEOSDK_WEBHOOK_ENDPOINT!;
    
    // [FIX] Ensure these exist in your .env file
    const b2AccessKey = process.env.B2_KEY_ID;
    const b2SecretKey = process.env.B2_APP_KEY;
    const region = process.env.B2_REGION;
    const b2Bucket = process.env.B2_BUCKET_NAME;
    const b2Endpoint = process.env.B2_ENDPOINT; // e.g. s3.us-east-005.backblazeb2.com

    const token = generateVideoSDKToken('moderator');
    const url = `${VIDEOSDK_API_ENDPOINT}/rooms`;

    const response = await axios.post(url, {
      autoStartConfig: {
        recording: {
          enabled: true,
          webhookUrl: webhookEndpoint,
          
          // [FIX 1] ADD STORAGE CONFIGURATION (awsLayer)
          // This forces VideoSDK to upload to YOUR Backblaze bucket
          awsLayer: {
            accessKeyId: b2AccessKey,
            secretAccessKey: b2SecretKey,
            bucketName: b2Bucket,
            endpoint: b2Endpoint, // Critical for Backblaze/DigitalOcean/etc.
            region: region
          },

          // [FIX 2] LAYOUT CONFIGURATION
          layout: {
            type: "SPOTLIGHT",
            priority: "PIN", // Logic: Records whoever is Pinned
            gridSize: 2,     // (Ignored in Spotlight, but good to keep low)
          },

          theme: "DARK",
          mode: "video-and-audio",
          quality: "med", // 720p
          orientation: "landscape",
        }
      }
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