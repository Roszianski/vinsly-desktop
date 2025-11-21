import YAML from 'yaml';

type FrontmatterRecord = Record<string, unknown>;

const YAML_OPTIONS = { lineWidth: 0 };

export const serializeFrontmatter = (frontmatter: FrontmatterRecord): string => {
  const sanitized = Object.entries(frontmatter).reduce<FrontmatterRecord>((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {});

  return YAML.stringify(sanitized, YAML_OPTIONS).trimEnd();
};
