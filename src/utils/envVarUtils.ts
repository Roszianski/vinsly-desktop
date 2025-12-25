/**
 * Environment Variable Utilities
 * Detect and preview ${VAR} and ${VAR:-default} patterns in config values
 */

/**
 * Environment variable reference found in a config value
 */
export interface EnvVarRef {
  fullMatch: string;      // "${VAR}" or "${VAR:-default}"
  varName: string;        // "VAR"
  defaultValue?: string;  // "default" if using fallback syntax
  startIndex: number;     // Position in the string
  endIndex: number;       // End position
}

/**
 * Result of attempting to resolve an env var
 */
export interface EnvVarResolution {
  ref: EnvVarRef;
  resolvedValue?: string;                          // The resolved value or undefined if not found
  source: 'environment' | 'default' | 'unresolved';
}

/**
 * Find all environment variable references in a string
 * Supports ${VAR} and ${VAR:-default} syntax
 */
export function findEnvVarRefs(value: string): EnvVarRef[] {
  const refs: EnvVarRef[] = [];
  // Pattern for ${VAR} and ${VAR:-default} syntax
  // Matches variable names starting with a letter or underscore, followed by letters, numbers, or underscores
  const pattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    refs.push({
      fullMatch: match[0],
      varName: match[1],
      defaultValue: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return refs;
}

/**
 * Check if a string contains environment variable references
 */
export function hasEnvVarRefs(value: string): boolean {
  const pattern = /\$\{[A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?\}/;
  return pattern.test(value);
}

/**
 * Preview what a value would expand to given a set of environment variables
 * Returns the expanded string with env vars replaced by their values
 */
export function expandEnvVars(
  value: string,
  envVars: Record<string, string | undefined>
): string {
  const pattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

  return value.replace(pattern, (match, varName, defaultValue) => {
    const envValue = envVars[varName];
    if (envValue !== undefined) {
      return envValue;
    }
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    return match; // Keep original if unresolved
  });
}

/**
 * Resolve environment variable references in a value
 * Returns detailed resolution info for each variable
 */
export function resolveEnvVarRefs(
  refs: EnvVarRef[],
  envVars: Record<string, string | undefined>
): EnvVarResolution[] {
  return refs.map(ref => {
    const envValue = envVars[ref.varName];

    if (envValue !== undefined) {
      return {
        ref,
        resolvedValue: envValue,
        source: 'environment' as const,
      };
    }

    if (ref.defaultValue !== undefined) {
      return {
        ref,
        resolvedValue: ref.defaultValue,
        source: 'default' as const,
      };
    }

    return {
      ref,
      resolvedValue: undefined,
      source: 'unresolved' as const,
    };
  });
}

/**
 * Get unique variable names from a value
 */
export function getEnvVarNames(value: string): string[] {
  const refs = findEnvVarRefs(value);
  return [...new Set(refs.map(ref => ref.varName))];
}

/**
 * Count unresolved variables in a set of resolutions
 */
export function countUnresolvedVars(resolutions: EnvVarResolution[]): number {
  return resolutions.filter(r => r.source === 'unresolved').length;
}

/**
 * Check if all variables in a value can be resolved
 */
export function allVarsResolved(
  value: string,
  envVars: Record<string, string | undefined>
): boolean {
  const refs = findEnvVarRefs(value);
  const resolutions = resolveEnvVarRefs(refs, envVars);
  return countUnresolvedVars(resolutions) === 0;
}

/**
 * Mask sensitive values for display
 * Shows first 3 chars and last 2 chars with asterisks in between
 */
export function maskSensitiveValue(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 3)}${'*'.repeat(Math.min(8, value.length - 5))}${value.slice(-2)}`;
}

/**
 * Common sensitive variable name patterns
 */
const SENSITIVE_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /key/i,
  /api_key/i,
  /apikey/i,
  /auth/i,
  /credential/i,
  /private/i,
];

/**
 * Check if a variable name likely contains sensitive data
 */
export function isSensitiveVar(varName: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(varName));
}
