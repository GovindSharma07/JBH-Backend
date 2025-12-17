import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
dotenv.config();

import AuthRoutes from './routes/authroutes'; 
import ApprenticeshipRoutes from './routes/apprenticeshipRoutes'; // <--- Import this
import ResumeRoutes from './routes/resumeRoutes'; // <--- Import Resume Routes
import AdminRoutes from './routes/adminRoutes';
import { startCleanupJob } from './jobs/cleanup';
import CourseRoutes from './routes/courseRoutes';
import PaymentRoutes from './routes/paymentRoutes';
import lmsRoutes from './routes/lmsRoutes';
import { videoSdkWebhook } from './controllers/webhookController';

const app = express();
app.use(cors({origin: ['http://localhost:3000']})); // Allow Flutter web or specific origin

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// WEBHOOK ROUTE (Public)
app.post('/api/webhooks/videosdk', videoSdkWebhook);

// Register Routes
app.use('/api', AuthRoutes);
app.use('/api', ApprenticeshipRoutes); // <--- Register this
app.use('/api', ResumeRoutes); // <--- Register Resume Routes
app.use('/api/lms', lmsRoutes);
app.use('/api',CourseRoutes);
app.use('/api', PaymentRoutes);
app.use('/api',AdminRoutes);

// To start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    startCleanupJob();
});