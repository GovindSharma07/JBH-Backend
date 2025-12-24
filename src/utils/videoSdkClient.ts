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

/**
 * Starts recording for a specific participant in a room.
 * * @param roomId - The ID of the room where the session is active.
 * @param participantId - The ID of the participant to be recorded.
 * @param options - Optional configuration for the recording (webhook, file format, etc.)
 */
export const startParticipantRecording = async (
  roomId: string, 
  participantId: string,
) => {
  try {
    // Generate a token with moderator permissions (required for recording)
    const token = generateVideoSDKToken('moderator');

    const response = await axios.post(
      `${VIDEOSDK_API_ENDPOINT}/recordings/participant/start`,
      {
        roomId,
        participantId,
        webhookUrl: "https://jbh-backend.onrender.com/api/webhook/videosdk",
      },
      {
        headers: { 
          Authorization: token,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`Recording started for participant ${participantId} in room ${roomId}`);
    return response.data;
  } catch (error: any) {
    console.error("Error starting participant recording:", error.response?.data || error.message);
    
    // Maintain consistency with your error handling
    throw new AppError(
      error.response?.data?.message || 'Failed to start participant recording', 
      error.response?.status || 500
    );
  }
};