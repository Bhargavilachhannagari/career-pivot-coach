import mongoose from 'mongoose';

export const MAX_RESUMES = 5;

const resumeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    nameKey: { type: String, required: true },
    fileName: { type: String, required: true },
    data: { type: Buffer, required: true, select: false },
    parsed: { type: mongoose.Schema.Types.Mixed, required: true },
    active: { type: Boolean, default: false },
  },
  { timestamps: true },
);

resumeSchema.index({ user: 1, nameKey: 1 }, { unique: true });

export default mongoose.model('Resume', resumeSchema);
