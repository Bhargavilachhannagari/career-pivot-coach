import multer from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../utils/httpError.js';

// Only messages are logged, so resume text never reaches the server logs.
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    return res.status(400).json({ error: `${issue.path.join('.') || 'input'}: ${issue.message}` });
  }
  if (err instanceof multer.MulterError) return res.status(400).json({ error: err.message });
  if (err.name === 'CastError') return res.status(400).json({ error: 'Invalid id' });

  console.error(err.message);
  res.status(500).json({ error: 'Something went wrong' });
}
