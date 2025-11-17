import dotenv from 'dotenv';
import cors from 'cors';
import express, {Request,Response} from 'express';
dotenv.config();
import AuthRoutes from './routes/authroutes'; 


const app = express();
app.use(cors({origin: ['http://localhost:3000']}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

  
app.use('/api', AuthRoutes);


//To start the server
const port = process.env.PORT || 3000;
const host = process.env.HOST;
app.listen(port, () => {
    console.log(`Server is running`);
});