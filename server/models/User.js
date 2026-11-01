import mongoose from 'mongoose';

export const DEMO_EMAIL = 'demo@example.com';

const resumeSchema = new mongoose.Schema(
  {
    fileName: String,
    description: String,
    summary: String,
    experience: [{ _id: false, title: String, organization: String, period: String, highlights: [String] }],
    education: [String],
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, select: false },
    name: { type: String, default: '' },
    targetRole: { type: String, default: '' },
    hoursPerWeek: { type: Number, default: 8 },
    timelineWeeks: { type: Number, default: 12 },
    resume: resumeSchema,
  },
  { timestamps: true },
);

export default mongoose.model('User', userSchema);
