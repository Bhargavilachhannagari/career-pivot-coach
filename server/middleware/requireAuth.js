import { findSessionUser } from '../services/auth.js';
import { HttpError } from '../utils/httpError.js';

export async function requireAuth(req, res, next) {
  req.user = await findSessionUser(req);
  if (!req.user) throw new HttpError(401, 'Please log in.');
  next();
}
