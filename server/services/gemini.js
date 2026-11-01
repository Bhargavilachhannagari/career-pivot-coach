import { createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import AiCache from '../models/AiCache.js';
import { HttpError } from '../utils/httpError.js';

export const FAST_MODEL = 'gemini-3.5-flash-lite';
export const SMART_MODEL = 'gemini-3.6-flash';

const MAX_ATTEMPTS = 2;
const REQUEST_TIMEOUT_MS = 60000;

let client;

// Lets tests replace the Gemini SDK client with a fake one.
export function setGeminiClient(fake) {
  client = fake;
}

function getClient() {
  if (client) return client;
  if (!process.env.GEMINI_API_KEY) {
    throw new HttpError(503, 'GEMINI_API_KEY is not set. Add it to server/.env and restart the server.');
  }
  client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function toResponseSchema(schema) {
  const { $schema, ...jsonSchema } = z.toJSONSchema(schema);
  return jsonSchema;
}

async function callGemini(request) {
  try {
    return await getClient().models.generateContent(request);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    console.error(`Gemini request failed: ${err.status ?? ''} ${err.message}`);
    // A busy or used-up model should not stop the demo, so fall back to the faster one.
    if ([429, 503].includes(err.status) && request.model !== FAST_MODEL) {
      const { thinkingConfig, ...config } = request.config;
      return callGemini({ ...request, model: FAST_MODEL, config });
    }
    if (err.status === 429) {
      throw new HttpError(503, 'Gemini rate limit reached. Please try again later, or tomorrow if the daily limit is used up.');
    }
    throw new HttpError(502, 'Gemini request failed. Please try again.');
  }
}

// Sends a request, validates the JSON reply against a Zod schema, and caches it by content hash.
export async function generateJson({ model, system, parts, schema }) {
  const responseJsonSchema = toResponseSchema(schema);
  const hash = createHash('sha256')
    .update(JSON.stringify({ model, system, parts, responseJsonSchema }))
    .digest('hex');

  const cached = await AiCache.findOne({ hash }).lean();
  if (cached) return schema.parse(cached.response);

  const request = {
    model,
    contents: [{ role: 'user', parts }],
    config: {
      systemInstruction: system,
      responseMimeType: 'application/json',
      responseJsonSchema,
      httpOptions: { timeout: REQUEST_TIMEOUT_MS },
      ...(model === SMART_MODEL && { thinkingConfig: { thinkingLevel: 'LOW' } }),
    },
  };

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const response = await callGemini(request);
    try {
      const parsed = schema.parse(JSON.parse(response.text));
      await AiCache.updateOne({ hash }, { $set: { model, response: parsed } }, { upsert: true });
      return parsed;
    } catch (err) {
      if (err instanceof z.ZodError || err instanceof SyntaxError) {
        console.error(`Gemini returned an invalid response (attempt ${attempt})`);
        continue;
      }
      throw err;
    }
  }

  throw new HttpError(502, 'Gemini returned an invalid response. Please try again.');
}
