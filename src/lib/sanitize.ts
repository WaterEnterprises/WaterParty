/**
 * Input sanitization utilities for XSS prevention.
 *
 * These helpers should be applied to any user-submitted text before
 * rendering it in the DOM or storing it for later display.
 */

/**
 * Strip HTML tags from a string, leaving only safe text content.
 * This is the most basic XSS defence and should be used on all
 * free-text user input shown in the UI.
 */
export function stripHtml(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Decode HTML entities back to their original characters.
 * Use this when reading previously-escaped data.
 */
export function decodeHtml(input: string): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&amp;/g, "&");
}

/**
 * Sanitize a string for safe insertion into the DOM as text content.
 * Equivalent to stripHtml, but also normalises whitespace.
 */
export function sanitizeText(input: string): string {
  return stripHtml(input).trim();
}

/**
 * Validate that a string does not contain obvious script injection
 * patterns. Returns `true` if the string appears safe.
 */
export function isSafeString(input: string): boolean {
  if (typeof input !== "string") return false;
  const dangerous = [
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on\w+\s*=/i,      // onclick=, onload=, etc.
    /data:\s*text\/html/i,
    /vbscript\s*:/i,
  ];
  return !dangerous.some((re) => re.test(input));
}

/**
 * Sanitize a social-media handle (strip @, URL prefixes, etc.).
 */
export function sanitizeHandle(input: string): string {
  if (!input) return "";
  let h = input.trim().replace(/^@/, "");
  // Full URLs
  h = h.replace(/^https?:\/\//, "");
  h = h.replace(/^www\./, "");
  // Known domains
  const domains = [
    "instagram.com/",
    "twitter.com/",
    "x.com/",
    "facebook.com/",
    "vk.com/",
    "t.me/",
    "telegram.me/",
  ];
  for (const domain of domains) {
    if (h.startsWith(domain)) {
      h = h.slice(domain.length);
      break;
    }
  }
  // Remove trailing slashes and query params
  h = h.split("/")[0].split("?")[0].split("#")[0];
  return sanitizeText(h);
}
