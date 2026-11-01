import mongoose from 'mongoose';

const jobDescriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true },
    company: { type: String, default: '' },
    text: { type: String, required: true },
    targetRole: { type: String, default: '' },
    roleKey: { type: String, default: '' },
    isEstimate: { type: Boolean, default: false },
    skills: [
      {
        _id: false,
        key: String,
        name: String,
        importance: { type: String, enum: ['required', 'preferred', 'nice'] },
        quote: String,
      },
    ],
    droppedSkills: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('JobDescription', jobDescriptionSchema);
