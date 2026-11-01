import mongoose from 'mongoose';

export const STATUSES = ['applied', 'no_response', 'rejected', 'response', 'interview', 'offer'];

const applicationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: String, required: true },
    title: { type: String, required: true },
    roleType: { type: String, required: true },
    seniority: { type: String, enum: ['entry', 'mid', 'senior'], required: true },
    industry: { type: String, required: true },
    source: { type: String, default: 'Other' },
    resumeVersion: { type: String, default: 'Main' },
    resume: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume' },
    status: { type: String, enum: STATUSES, default: 'applied' },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('Application', applicationSchema);
