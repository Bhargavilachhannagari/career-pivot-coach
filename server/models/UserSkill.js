import mongoose from 'mongoose';

const userSkillSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    name: { type: String, required: true },
    proficiency: { type: Number, min: 0, max: 1, required: true },
    source: { type: String, enum: ['resume', 'self', 'interview', 'task'], required: true },
  },
  { timestamps: true },
);

userSkillSchema.index({ user: 1, key: 1 }, { unique: true });

export default mongoose.model('UserSkill', userSkillSchema);
