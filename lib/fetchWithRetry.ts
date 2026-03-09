/**
 * Fetch with exponential backoff retry logic
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param initialDelay - Initial delay in ms before first retry (default: 500)
 * @returns The fetch response
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  initialDelay: number = 500
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx), only on server errors (5xx)
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Server error - will retry
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);

    } catch (error) {
      // Network error - will retry
      lastError = error as Error;
    }

    // Don't delay after the last attempt
    if (attempt < maxRetries) {
      const delay = initialDelay * Math.pow(2, attempt); // Exponential backoff: 500, 1000, 2000, 4000...
      console.log(`Fetch attempt ${attempt + 1} failed for ${url}, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  console.error(`All ${maxRetries + 1} fetch attempts failed for ${url}`);
  throw lastError;
}

/**
 * Fetch JSON with retry logic
 * @param url - The URL to fetch
 * @param options - Fetch options
 * @param maxRetries - Maximum number of retry attempts
 * @returns Parsed JSON response
 */
export async function fetchJsonWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const response = await fetchWithRetry(url, options, maxRetries);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Calculate Jaccard similarity between two arrays
 * Used for semantic deduplication of news stories
 * @param arr1 - First array of keywords
 * @param arr2 - Second array of keywords
 * @returns Similarity score between 0 and 1
 */
export function calculateJaccardSimilarity(arr1: string[], arr2: string[]): number {
  if (!arr1?.length || !arr2?.length) return 0;

  const set1 = new Set(arr1.map(s => s.toLowerCase()));
  const set2 = new Set(arr2.map(s => s.toLowerCase()));

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Truncate text at word boundary to avoid cutting words mid-way
 * @param text - The text to truncate
 * @param maxLength - Maximum length
 * @param suffix - Optional suffix to append (default: empty)
 * @returns Truncated text at word boundary
 */
export function truncateAtWordBoundary(text: string, maxLength: number, suffix: string = ''): string {
  if (!text || text.length <= maxLength) return text;

  // Account for suffix length
  const effectiveMax = maxLength - suffix.length;
  if (effectiveMax <= 0) return suffix;

  // Find the last space before the limit
  const truncated = text.substring(0, effectiveMax);
  const lastSpace = truncated.lastIndexOf(' ');

  // If no space found (single long word), just cut at max length
  if (lastSpace === -1) return truncated + suffix;

  // Truncate at the last word boundary
  return truncated.substring(0, lastSpace).trim() + suffix;
}
