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
        endPoint: "https://jbh-backend.onrender.com/api/webhook/videosdk",
        events: [
      'recording-started',
      'recording-stopped',
      'recording-failed',
      'participant-joined',
      'participant-left',
      'session-ended'
        ]
      },
    }, {
      headers: { Authorization: token }
    });
    console.log("Created VideoSDK Room:", response.data.roomId);
    return response.data.roomId;
  } catch (error) {
    console.error("Error creating VideoSDK room:", error);
    throw new AppError('Failed to create room', 500);
  }
};