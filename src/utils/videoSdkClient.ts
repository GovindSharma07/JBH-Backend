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
      ? ['allow_join', 'allow_mod', 'allow_publish']  // <--- Added allow_publish
      : ['allow_join', 'allow_publish'],               // <--- Added allow_publish
    version: 2,
    roles: [role] 
  };

  // @ts-ignore
  return jwt.sign(payload, VIDEOSDK_SECRET_KEY as string, options);
};;

export const createMeetingRoom = async () => {
  try {
    const token = generateVideoSDKToken('moderator');
    const url = `${VIDEOSDK_API_ENDPOINT}/rooms`;
    
    const response = await axios.post(url, {}, {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json'
      }
    });

    return response.data.roomId; // Returns e.g., "abc-defg-hij"
  } catch (error) {
    console.error("Error creating VideoSDK Room:", error);
    throw new AppError('Failed to create live classroom', 500);
  }
};