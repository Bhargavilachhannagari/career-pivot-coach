// Runs the API with a temporary in-memory MongoDB and the demo data, so no Atlas account is needed.
// All data is lost when the server stops.
import 'dotenv/config';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { seedDemo } from './seedDemo.js';

const mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60000 } });
process.env.MONGODB_URI = mongo.getUri('career-pivot-coach');

await import('../index.js');
await mongoose.connection.asPromise();
await seedDemo();
console.log('Temporary database ready with demo data.');
