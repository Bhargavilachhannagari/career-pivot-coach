import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import Session from '../models/Session.js';

const scryptAsync = promisify(scrypt);

const KEY_LENGTH = 64;
const SESSION_DAYS = 7;
const SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE = 'session';

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(':');
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return timingSafeEqual(key, Buffer.from(expected, 'hex'));
}

// Checked when an email is unknown, so a login takes the same time either way.
export const DUMMY_HASH = await hashPassword(randomBytes(16).toString('hex'));

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

// Only a hash of the token is stored, so a database leak does not expose live sessions.
export async function startSession(res, userId) {
  const token = randomBytes(32).toString('hex');
  await Session.create({
    user: userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_MS });
}

export async function endSession(req, res) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
  res.clearCookie(SESSION_COOKIE, cookieOptions());
}

export async function findSessionUser(req) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== 'string') return null;

  const session = await Session.findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } }).populate('user');
  return session?.user ?? null;
}
