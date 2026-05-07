'use server';

import { GoogleGenerativeAI, Content } from '@google/generative-ai';

const DEFAULT_MODEL = 'gemini-3-flash-preview';
const MAX_INPUT_LENGTH = 8000;
const MAX_HISTORY_MESSAGES = 8;
const MAX_SERVER_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const FETCH_TIMEOUT_MS = 15_000; // 15 seconds

// --- FIX #6: Server-side MIME type allowlist ---
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp',
  'application/pdf',
];

// --- FIX #1: Firebase Storage URL allowlist (prevents SSRF) ---
const ALLOWED_URL_PREFIXES = [
  'https://firebasestorage.googleapis.com/',
  'https://storage.googleapis.com/',
];

function isAllowedUrl(url: string): boolean {
  // Match explicit prefixes
  if (ALLOWED_URL_PREFIXES.some(prefix => url.startsWith(prefix))) return true;
  // Match newer Firebase Storage URLs: https://<project>.firebasestorage.app/
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.firebasestorage.app')) return true;
  } catch {
    // Invalid URL
  }
  return false;
}

// --- FIX #2: Simple in-memory rate limiter (per-user) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 20; // 20 requests per minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// Periodically clean stale entries to prevent memory leak in long-running server
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    rateLimitMap.forEach((entry, key) => {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    });
  }, 5 * 60_000); // every 5 minutes
}

// --- FIX #8: Singleton SDK client ---
let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) return null;
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

const justSystemInstructions = `You are "Prompttune AI," a friendly prompt engineering expert. Be concise and helpful.

**CRITICAL RULE — Match your response length to the user's intent:**
- For greetings, casual chat, or simple questions: reply in 1-3 short sentences. Do NOT use the leveled format.
- For prompt requests (crafting, improving, or reverse-engineering prompts): use the structured format below.

**Structured format (ONLY for prompt-crafting requests):**
When the user asks you to create, improve, or analyze a prompt, respond with three levels:

## Beginner Level
### Explanation
Brief explanation of the simple approach.
### Suggested Prompt
> A ready-to-use prompt with **bold customizable parts**.

## Intermediate Level
### Explanation
What this adds and why.
### Suggested Prompt
> A more detailed prompt with **bold customizable parts**.

## Advanced Level
### Explanation
Advanced techniques and when to use them.
### Suggested Prompt
> A comprehensive prompt with **bold customizable parts**.

End with a brief invitation to refine further.

**General rules:**
- Use Markdown for readability. Use blockquotes for prompts.
- If the user uploads an image or document, analyze it and generate prompts based on its content.
- If the request is vague, ask 1-2 clarifying questions before generating prompts.
- Be encouraging, clear, and avoid jargon.`;

interface GenerateResponse {
  success: boolean;
  data?: string;
  error?: string;
}

export type ContentPart = { text?: string; url?: string; mimeType?: string };

// --- FIX #9: Fetch with timeout via AbortController ---
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function processParts(parts: ContentPart[]): Promise<any[]> {
  const processedParts = await Promise.all(
    parts.map(async (part) => {
      if (part.text && part.text.trim()) {
        return { text: part.text };
      }
      if (part.url && part.mimeType) {
        // If the client already sent the base64 data (optimization), use it directly
        if ((part as any).base64Data) {
          console.log("[processParts] Using provided base64 data (client-side optimization)");
          return {
            inlineData: {
              data: (part as any).base64Data,
              mimeType: part.mimeType
            }
          };
        }

        // FIX #1: Validate URL is a Firebase Storage URL
        if (!isAllowedUrl(part.url)) {
          console.warn("[processParts] BLOCKED non-Firebase URL:", part.url.substring(0, 100));
          return null;
        }

        // FIX #6: Validate MIME type
        if (!ALLOWED_MIME_TYPES.includes(part.mimeType)) {
          console.warn("[processParts] BLOCKED disallowed mimeType:", part.mimeType);
          return null;
        }

        try {
          console.log("[processParts] Fetching file:", part.mimeType, part.url.substring(0, 80) + "...");
          const response = await fetchWithTimeout(part.url, FETCH_TIMEOUT_MS);
          if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

          const buffer = await response.arrayBuffer();
          console.log("[processParts] Fetched OK, size:", (buffer.byteLength / 1024).toFixed(1), "KB");
          
          if (buffer.byteLength > MAX_SERVER_FILE_SIZE) {
            console.warn("[processParts] File exceeded 5MB server limit, skipping.");
            return null;
          }

          const base64Data = Buffer.from(buffer).toString('base64');
          console.log("[processParts] Converted to base64, sending to Gemini as inlineData");
          return {
            inlineData: {
              data: base64Data,
              mimeType: part.mimeType
            }
          };
        } catch (e: any) {
          if (e?.name === 'AbortError') {
            console.error("[processParts] TIMEOUT: File fetch timed out after", FETCH_TIMEOUT_MS, "ms");
          } else {
            console.error("[processParts] ERROR:", e?.message || e);
          }
          return null;
        }
      }
      return null;
    })
  );

  return processedParts.filter(Boolean);
}

export async function refinePromptOrGeneratePath(
  currentParts: ContentPart[],
  history?: { role: 'user' | 'model', parts: ContentPart[] }[],
  userId?: string // FIX #2: Require userId for rate limiting
): Promise<GenerateResponse> {
  // FIX #2: Rate limit check
  if (!userId || typeof userId !== 'string' || userId.length < 10 || userId.length > 128) {
    return { success: false, error: 'Unauthorized: Invalid user session.' };
  }

  if (!checkRateLimit(userId)) {
    return { success: false, error: 'Too many requests. Please wait a moment and try again.' };
  }

  const genAI = getGenAI();
  if (!genAI) {
    console.error('Gemini API key not found or empty.');
    return { success: false, error: 'Server configuration error: API key is missing or invalid.' };
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  const hasText = currentParts.some(p => p.text && p.text.trim().length > 0);
  const hasFile = currentParts.some(p => p.url);

  if (!hasText && !hasFile) {
    return { success: false, error: 'User input cannot be empty.' };
  }

  const combinedText = currentParts.map(p => p.text || '').join(' ').trim();
  if (combinedText.length > MAX_INPUT_LENGTH) {
    return {
      success: false,
      error: `Please shorten your message text to ${MAX_INPUT_LENGTH.toLocaleString()} characters or fewer.`
    };
  }

  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: justSystemInstructions,
      generationConfig: {
        maxOutputTokens: 4096,
      },
    });

    const contentsForApi: Content[] = [];

    if (history?.length) {
      const validHistory = history.slice(-MAX_HISTORY_MESSAGES);
      const processedHistory = await Promise.all(
        validHistory.map(async (item) => {
          const processed = await processParts(item.parts);
          return { role: item.role, parts: processed };
        })
      );

      for (const item of processedHistory) {
        if (item.parts.length > 0) {
          contentsForApi.push(item as Content);
        }
      }
    }

    const processedCurrent = await processParts(currentParts);
    if (processedCurrent.length > 0) {
      contentsForApi.push({
        role: 'user',
        parts: processedCurrent
      });
    }

    const result = await model.generateContent({ contents: contentsForApi });
    const response = result.response;

    if (!response) {
      return { success: false, error: 'No response received from AI model.' };
    }

    const text = response.text();
    if (!text?.trim()) {
      return { success: false, error: 'Empty response received from AI model.' };
    }

    return { success: true, data: text };
  } catch (error) {
    console.error('Error in refinePromptOrGeneratePath:', error);

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      if (message.includes('api key')) {
        return { success: false, error: 'Authentication error: Invalid API key.' };
      }
      if (message.includes('quota') || message.includes('rate limit')) {
        return { success: false, error: 'Rate limit exceeded. Please try again later.' };
      }
      if (message.includes('model')) {
        return { success: false, error: `Model error for ${modelName}. Please check GEMINI_MODEL or try again later.` };
      }
    }

    return { success: false, error: 'An unexpected error occurred while generating content.' };
  }
}
