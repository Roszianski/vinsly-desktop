import YAML from 'yaml';
import { AgentScope, Skill } from '../types';
import { serializeFrontmatter } from './frontmatter';
import { SkillFile } from './tauriCommands';
import { devLog } from './devLogger';

const SKILL_FRONTMATTER_REGEX = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;

interface ParsedSkillMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

function parseSkillMarkdown(content: string): ParsedSkillMarkdown | null {
  const match = content.match(SKILL_FRONTMATTER_REGEX);
  if (!match) {
    return null;
  }

  const [, frontmatterText, body] = match;
  try {
    const parsed = YAML.parse(frontmatterText) ?? {};
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return { frontmatter: parsed as Record<string, unknown>, body: body.trim() };
  } catch (error) {
    devLog.error('Failed to parse skill frontmatter:', error);
    return null;
  }
}

const scopeFromString = (value: string): AgentScope =>
  value === 'project' ? AgentScope.Project : AgentScope.Global;

export function skillFileToSkill(file: SkillFile): Skill | null {
  const parsed = parseSkillMarkdown(file.content);
  if (!parsed) {
    return null;
  }

  const name =
    typeof parsed.frontmatter.name === 'string'
      ? parsed.frontmatter.name.trim()
      : (file.name || '').trim();
  const description =
    typeof parsed.frontmatter.description === 'string'
      ? parsed.frontmatter.description.trim()
      : '';

  if (!name || !description) {
    return null;
  }

  return {
    id: file.directory,
    name,
    scope: scopeFromString(file.scope),
    directoryPath: file.directory,
    path: file.path,
    frontmatter: {
      ...parsed.frontmatter,
      name,
      description,
    },
    body: parsed.body,
    hasAssets: file.has_assets,
  };
}

export function skillToMarkdown(skill: Skill): string {
  const frontmatterYaml = serializeFrontmatter(skill.frontmatter);
  return `---\n${frontmatterYaml}\n---\n\n${skill.body || ''}`;
}
