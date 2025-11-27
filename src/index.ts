import dotenv from 'dotenv';
import cors from 'cors';
import express from 'express';
dotenv.config();

import AuthRoutes from './routes/authroutes'; 
import ApprenticeshipRoutes from './routes/apprenticeshipRoutes'; // <--- Import this

const app = express();
app.use(cors({origin: ['http://localhost:3000']})); // Allow Flutter web or specific origin

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Register Routes
app.use('/api', AuthRoutes);
app.use('/api', ApprenticeshipRoutes); // <--- Register this

// To start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});