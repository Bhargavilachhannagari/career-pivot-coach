import { z } from 'zod';
import User from '../models/User.js';
import {
  DUMMY_HASH,
  endSession,
  findSessionUser,
  hashPassword,
  startSession,
  verifyPassword,
} from '../services/auth.js';
import { HttpError } from '../utils/httpError.js';

const DUPLICATE_KEY = 11000;

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(254);

const registerInput = z.object({
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginInput = z.object({ email, password: z.string().min(1).max(128) });

const publicUser = (user) => ({ email: user.email, name: user.name });

export async function register(req, res) {
  const input = registerInput.parse(req.body);

  let user;
  try {
    user = await User.create({ email: input.email, passwordHash: await hashPassword(input.password) });
  } catch (err) {
    if (err.code === DUPLICATE_KEY) throw new HttpError(409, 'An account with this email already exists.');
    throw err;
  }

  await startSession(res, user._id);
  res.status(201).json({ user: publicUser(user) });
}

export async function login(req, res) {
  const input = loginInput.parse(req.body);
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user?.passwordHash || !valid) throw new HttpError(401, 'Incorrect email or password.');

  await startSession(res, user._id);
  res.json({ user: publicUser(user) });
}

export async function logout(req, res) {
  await endSession(req, res);
  res.status(204).end();
}

export async function me(req, res) {
  const user = await findSessionUser(req);
  res.json({ user: user ? publicUser(user) : null });
}
