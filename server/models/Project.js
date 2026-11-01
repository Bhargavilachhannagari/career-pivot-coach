import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    summary: String,
    deliverables: [String],
    skills: [String],
    difficulty: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
    estimatedHours: Number,
  },
  { timestamps: true },
);

export default mongoose.model('Project', projectSchema);
