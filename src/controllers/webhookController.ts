import { Request, Response } from 'express';
import { WebhookService } from '../services/webhookService';

export const videoSdkWebhook = async (req: Request, res: Response) => {
  try {
    // Delegate logic to Service
    await WebhookService.handleVideoSdkWebhook(req.body);

    // Always return 200 OK to VideoSDK so they don't retry the webhook endlessly
    return res.status(200).send('OK');
  } catch (error) {
    console.error("❌ Webhook Controller Error:", error);
    // Even on error, we often send 200 to acknowledge receipt, 
    // unless you want VideoSDK to retry (then send 500).
    return res.status(500).send("Webhook Failed");
  }
};