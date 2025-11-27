import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// 1. Validate Env Variables to fix TypeScript "string | undefined" error
const BUCKET_NAME = process.env.B2_BUCKET_NAME;
const ENDPOINT = process.env.B2_ENDPOINT;
const REGION = process.env.B2_REGION || "us-east-005";
const KEY_ID = process.env.B2_KEY_ID;
const APP_KEY = process.env.B2_APP_KEY;
const CDN_URL = process.env.CLOUDFLARE_CDN_URL || "";

if (!BUCKET_NAME || !ENDPOINT || !KEY_ID || !APP_KEY) {
  throw new Error("Missing Backblaze B2 configuration in .env");
}

// 2. Initialize S3 Client (Backblaze Compatible)
const s3Client = new S3Client({
  region: REGION,
  endpoint: ENDPOINT, // Now guaranteed to be a string
  credentials: {
    accessKeyId: KEY_ID,
    secretAccessKey: APP_KEY,
  },
});

// 3. Helper to generate atomic upload URL
export const generatePresignedUploadUrl = async (fileName: string, fileType: string) => {
  // Unique file path: resumes/{user_id_placeholder}/{timestamp}_{filename}
  // Note: We don't have userId here easily without passing it, using timestamp is safe enough
  const key = `resumes/${Date.now()}_${fileName.replace(/\s+/g, "_")}`;
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
  });

  // URL valid for 5 minutes
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });
  
  return {
    uploadUrl,                  // Frontend uploads BINARY here
    publicUrl: `${CDN_URL}/${key}`, // Frontend sends this to Backend to save
    fileKey: key
  };
};