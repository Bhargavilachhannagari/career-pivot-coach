import mongoose from 'mongoose';

const aiCacheSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true, unique: true },
    model: { type: String, required: true },
    response: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export default mongoose.model('AiCache', aiCacheSchema);
