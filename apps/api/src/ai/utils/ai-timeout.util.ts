/**
 * AI Timeout Utility — Phase 8 Hardening
 *
 * Wraps an async AI provider call with a configurable timeout.
 * If the AI call does not resolve within `timeoutMs`, the provided
 * `fallback` value is returned instead of throwing — preventing runaway
 * AI requests from blocking the entire request lifecycle.
 *
 * SAFETY: The original promise is NOT cancelled (JS has no native
 * cancellation), but any result it later produces is ignored.
 *
 * Usage:
 *   const text = await withAiTimeout(provider.complete(prompt, opts), 30_000, 'fallback');
 */
export async function withAiTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => {
      resolve(fallback);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}
