import 'dotenv/config';
import mongoose from 'mongoose';
import { seedDemo } from './seedDemo.js';

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not set. Add it to server/.env first.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
await seedDemo();
await mongoose.disconnect();
console.log('Demo data loaded.');
