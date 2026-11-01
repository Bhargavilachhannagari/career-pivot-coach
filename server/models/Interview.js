import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  skill: { type: String, required: true },
  text: { type: String, required: true },
  answer: String,
  scores: [
    {
      _id: false,
      criterion: String,
      label: String,
      score: Number,
      quote: String,
      verified: Boolean,
      feedback: String,
    },
  ],
  overall: Number,
  summary: String,
  improvement: String,
  answeredAt: Date,
});

const interviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetRole: String,
    focusSkill: String,
    focusWeek: Number,
    questions: [questionSchema],
    overall: Number,
  },
  { timestamps: true },
);

export default mongoose.model('Interview', interviewSchema);
