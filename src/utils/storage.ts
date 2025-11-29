import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_NAME = process.env.B2_BUCKET_NAME;
const ENDPOINT = process.env.B2_ENDPOINT;
const REGION = process.env.B2_REGION || "us-east-005";
const KEY_ID = process.env.B2_KEY_ID;
const APP_KEY = process.env.B2_APP_KEY;
const CDN_URL = process.env.CLOUDFLARE_CDN_URL || "";

// Lazy Client Wrapper
let s3Client: S3Client | null = null;

const getClient = () => {
  if (s3Client) return s3Client;
  if (!BUCKET_NAME || !ENDPOINT || !KEY_ID || !APP_KEY) {
    console.warn("⚠️ STORAGE WARNING: Config missing.");
    return null;
  }
  s3Client = new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: { accessKeyId: KEY_ID, secretAccessKey: APP_KEY },
  });
  return s3Client;
};

// Modified to accept a folder name
export const generatePresignedUploadUrl = async (fileName: string, fileType: string, folder: string = 'resumes') => {
  const client = getClient();
  if (!client || !BUCKET_NAME) throw new Error("Storage config missing");

  // Clean filename and create path: folder/timestamp_filename
  const cleanName = fileName.replace(/\s+/g, "_");
  const key = `${folder}/${Date.now()}_${cleanName}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  
  return {
    uploadUrl,
    publicUrl: `${CDN_URL}/${key}`,
    fileKey: key
  };
};