/**
 * Development-only logger utility.
 * These functions only log in development mode, keeping production builds clean.
 */

const isDev = import.meta.env.DEV;

export const devLog = {
  error: (...args: unknown[]) => {
    if (isDev) console.error(...args);
  },
  warn: (...args: unknown[]) => {
    if (isDev) console.warn(...args);
  },
  log: (...args: unknown[]) => {
    if (isDev) console.log(...args);
  },
  debug: (...args: unknown[]) => {
    if (isDev) console.debug(...args);
  },
};
