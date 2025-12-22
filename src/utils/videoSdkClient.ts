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

    const token = generateVideoSDKToken('moderator');
    const url = `${VIDEOSDK_API_ENDPOINT}/rooms`;

    const response = await axios.post(url, {
      // Simple Auto-Recording Config
      autoStartConfig: {
        recording: {
          enabled: true,

          webhookUrl: webhookEndpoint,
          // "SPOTLIGHT" = Records ONLY the active focus (Camera OR Screen OR Board)
          layout: {
            type: "SPOTLIGHT",
            priority: "PIN", // Records the pinned instructor
          },

          theme: "DARK",
          mode: "video-and-audio",

          // "med" = 720p (HD) -> Cost effective & Good Quality
          quality: "med",

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