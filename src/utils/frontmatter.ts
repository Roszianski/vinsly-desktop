import YAML from 'yaml';

type FrontmatterRecord = Record<string, unknown>;

const YAML_OPTIONS = { lineWidth: 0 };

/**
 * Convert camelCase to kebab-case
 * e.g., "disableModelInvocation" -> "disable-model-invocation"
 */
const toKebabCase = (str: string): string => {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
};

/**
 * Convert kebab-case to camelCase
 * e.g., "disable-model-invocation" -> "disableModelInvocation"
 */
export const toCamelCase = (str: string): string => {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
};

/**
 * Keys that should be serialized as kebab-case in YAML frontmatter
 * (per Claude Code official spec)
 */
const KEBAB_CASE_KEYS = new Set([
  'disableModelInvocation',
  'argumentHint',
  'allowedTools',
  'permissionMode',
]);

export const serializeFrontmatter = (frontmatter: FrontmatterRecord): string => {
  const sanitized = Object.entries(frontmatter).reduce<FrontmatterRecord>((acc, [key, value]) => {
    if (value !== undefined) {
      // Convert known camelCase keys to kebab-case for YAML output
      const outputKey = KEBAB_CASE_KEYS.has(key) ? toKebabCase(key) : key;
      acc[outputKey] = value;
    }
    return acc;
  }, {});

  return YAML.stringify(sanitized, YAML_OPTIONS).trimEnd();
};

/**
 * Parse frontmatter and convert kebab-case keys back to camelCase
 */
export const parseFrontmatter = (yamlContent: string): FrontmatterRecord => {
  const parsed = YAML.parse(yamlContent) as FrontmatterRecord;
  if (!parsed || typeof parsed !== 'object') {
    return {};
  }

  return Object.entries(parsed).reduce<FrontmatterRecord>((acc, [key, value]) => {
    // Convert kebab-case keys to camelCase for TypeScript usage
    const camelKey = key.includes('-') ? toCamelCase(key) : key;
    acc[camelKey] = value;
    return acc;
  }, {});
};
