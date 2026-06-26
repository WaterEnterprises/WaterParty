/**
 * Unified logger with environment-aware gating.
 *
 * - In development: all log levels are printed to the console.
 * - In production: `debug` and `log` are suppressed; `warn`, `error`, and `info` are still visible.
 *
 * All methods accept the same arguments as their `console.*` counterparts.
 */

const IS_PRODUCTION =
  typeof process !== "undefined" &&
  (process.env.NODE_ENV === "production" ||
   (typeof window !== "undefined" && (window as any).__PROD__ === true));

// Guard against missing console in older JS runtimes
const noop = (..._args: unknown[]) => {};

function createLogger() {
  if (typeof console === "undefined") {
    return {
      debug: noop,
      log: noop,
      info: noop,
      warn: noop,
      error: noop,
    };
  }

  return {
    /** Detailed debugging — stripped in production. */
    debug: IS_PRODUCTION ? noop : console.debug.bind(console, "[debug]"),

    /** General log — stripped in production. */
    log: IS_PRODUCTION ? noop : console.log.bind(console, "[log]"),

    /** Important informational messages (visible in production). */
    info: console.info.bind(console, "[info]"),

    /** Non-critical warnings (visible in production). */
    warn: console.warn.bind(console, "[warn]"),

    /** Errors (visible in production). */
    error: console.error.bind(console, "[error]"),
  };
}

export const logger = createLogger();
