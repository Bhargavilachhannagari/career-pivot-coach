import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  skill: { type: String, required: true },
  hours: { type: Number, required: true },
  resourceUrl: String,
  done: { type: Boolean, default: false },
  isPractice: { type: Boolean, default: false },
  forScoreCount: Number,
  completedByFinish: Number,
});

const weekSchema = new mongoose.Schema(
  {
    week: { type: Number, required: true },
    theme: String,
    tasks: [taskSchema],
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, required: true },
    reason: { type: String, required: true },
    targetRole: String,
    hoursPerWeek: { type: Number, required: true },
    weeks: [weekSchema],
    deferredSkills: [String],
    currentWeek: { type: Number, default: 1 },
    weekLog: [
      {
        _id: false,
        week: Number,
        plannedHours: Number,
        doneHours: Number,
        moved: [{ _id: false, title: String, skill: String, hours: Number }],
      },
    ],
    lastWorkloadCutWeek: { type: Number, default: 0 },
    changes: [String],
    undone: { type: Boolean, default: false },
  },
  { timestamps: true },
);

planSchema.index({ user: 1, version: -1 }, { unique: true });

export default mongoose.model('Plan', planSchema);
