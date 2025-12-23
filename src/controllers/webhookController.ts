import { Request, Response } from 'express';
import { WebhookService } from '../services/webhookService';

export const videoSdkWebhook = async (req: Request, res: Response) => {
  // ✅ 1. IMMEDIATE LOG: This proves VideoSDK hit your server
  console.log("🔔 Incoming VideoSDK Webhook Payload:", JSON.stringify(req.body, null, 2));

  try {
    await WebhookService.handleVideoSdkWebhook(req.body);
    console.log("✅ Webhook processed successfully.");
    return res.status(200).send('OK');
  } catch (error) {
    console.error("❌ Webhook Controller Error:", error);
    return res.status(200).send("Handled with Error"); // Still send 200 to stop retries
  }
};