import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app.js';

const { MONGODB_URI, PORT = 5000 } = process.env;

if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Add it to server/.env, or run "npm run dev:demo" to use a temporary database.');
  process.exit(1);
}

await mongoose.connect(MONGODB_URI);
app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
