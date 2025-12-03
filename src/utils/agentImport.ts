import JSZip from 'jszip';
import YAML from 'yaml';
import { Agent, AgentScope } from '../types';
import { open } from '@tauri-apps/plugin-dialog';
import { importTextFile, importBinaryFile } from './tauriCommands';

const FRONTMATTER_REGEX = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/;

// Security and performance limits
const MAX_ZIP_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB per file
const IMPORT_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Validate file size before processing
 */
function validateFileSize(file: File, maxSize: number = MAX_FILE_SIZE_BYTES): void {
  if (file.size > maxSize) {
    throw new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`);
  }
}

/**
 * Add timeout to a promise
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms: ${operation}`)), timeoutMs)
    )
  ]);
}

/**
 * Parse markdown content and extract frontmatter and body
 */
function parseMarkdown(content: string): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = content.match(FRONTMATTER_REGEX);

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
    console.error('Failed to parse frontmatter YAML:', error);
    return null;
  }
}

/**
 * Check if a markdown file contains a subagent definition
 * A valid subagent has at minimum: name and description in frontmatter
 */
export function hasSubagentDefinition(content: string): boolean {
  const parsed = parseMarkdown(content);
  if (!parsed) {
    return false;
  }

  const { frontmatter } = parsed;
  return typeof frontmatter.name === 'string' && frontmatter.name.trim().length > 0
    && typeof frontmatter.description === 'string' && frontmatter.description.trim().length > 0;
}

/**
 * Convert markdown content to an Agent object
 */
export function markdownToAgent(
  content: string,
  fileName: string,
  scope: AgentScope = AgentScope.Global,
  actualPath?: string
): Agent | null {
  const parsed = parseMarkdown(content);
  if (!parsed) {
    return null;
  }

  const { frontmatter, body } = parsed;

  const name = typeof frontmatter.name === 'string' ? frontmatter.name.trim() : '';
  const description = typeof frontmatter.description === 'string' ? frontmatter.description.trim() : '';

  if (!name || !description) {
    return null;
  }

  const basePath = scope === AgentScope.Project ? '.claude/agents/' : '~/.claude/agents/';
  const displayPath = `${basePath}${name}.md`;
  const resolvedPath = actualPath || displayPath;

  const agent: Agent = {
    id: resolvedPath,
    name,
    scope,
    path: resolvedPath, // Use actual path from backend if provided
    frontmatter: {
      ...(frontmatter as Record<string, unknown>),
      name,
      description,
    } as Agent['frontmatter'],
    body,
  };

  return agent;
}

/**
 * Import a single .md file
 */
export async function importAgentFromFile(
  file: File,
  scope: AgentScope = AgentScope.Global
): Promise<Agent | null> {
  try {
    // Validate file size
    validateFileSize(file);

    // Read with timeout
    const content = await withTimeout(file.text(), IMPORT_TIMEOUT_MS, 'reading file');

    if (!hasSubagentDefinition(content)) {
      throw new Error('File does not contain a valid subagent definition');
    }

    const agent = markdownToAgent(content, file.name, scope);
    return agent;
  } catch (error) {
    console.error('Error importing agent from file:', error);
    throw error;
  }
}

/**
 * Import agents from a .zip bundle
 */
export async function importAgentsFromZip(
  file: File,
  scope: AgentScope = AgentScope.Global
): Promise<{ agents: Agent[]; errors: string[] }> {
  const agents: Agent[] = [];
  const errors: string[] = [];

  try {
    // Validate ZIP file size
    validateFileSize(file, MAX_ZIP_SIZE_BYTES);

    // Load ZIP with timeout
    const zip = await withTimeout(JSZip.loadAsync(file), IMPORT_TIMEOUT_MS, 'loading ZIP file');

    for (const [fileName, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir || !fileName.endsWith('.md')) {
        continue;
      }

      try {
        const content = await zipEntry.async('text');

        if (!hasSubagentDefinition(content)) {
          errors.push(`${fileName}: Missing required frontmatter (name and description)`);
          continue;
        }

        const agent = markdownToAgent(content, fileName, scope);
        if (agent) {
          agents.push(agent);
        } else {
          errors.push(`${fileName}: Failed to parse agent`);
        }
      } catch (error) {
        errors.push(`${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { agents, errors };
  } catch (error) {
    throw new Error(`Failed to read zip file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Import agent from a markdown file path
 */
async function importAgentFromPath(
  filePath: string,
  scope: AgentScope = AgentScope.Global
): Promise<Agent | null> {
  try {
    const content = await importTextFile(filePath);
    const fileName = filePath.split('/').pop() || '';

    if (!hasSubagentDefinition(content)) {
      throw new Error('File does not contain a valid subagent definition');
    }

    const agent = markdownToAgent(content, fileName, scope);
    return agent;
  } catch (error) {
    console.error('Error importing agent from path:', error);
    throw error;
  }
}

/**
 * Import agents from a zip file path
 */
async function importAgentsFromZipPath(
  filePath: string,
  scope: AgentScope = AgentScope.Global
): Promise<{ agents: Agent[]; errors: string[] }> {
  const agents: Agent[] = [];
  const errors: string[] = [];

  try {
    // Read the zip file as binary using safe Rust command
    const binaryData = await importBinaryFile(filePath);
    const uint8Array = new Uint8Array(binaryData);
    const zip = await JSZip.loadAsync(uint8Array);

    for (const [fileName, zipEntry] of Object.entries(zip.files)) {
      if (zipEntry.dir || !fileName.endsWith('.md')) {
        continue;
      }

      try {
        const content = await zipEntry.async('text');

        if (!hasSubagentDefinition(content)) {
          errors.push(`${fileName}: Missing required frontmatter (name and description)`);
          continue;
        }

        const agent = markdownToAgent(content, fileName, scope);
        if (agent) {
          agents.push(agent);
        } else {
          errors.push(`${fileName}: Failed to parse agent`);
        }
      } catch (error) {
        errors.push(`${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { agents, errors };
  } catch (error) {
    throw new Error(`Failed to read zip file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Trigger Tauri file picker for importing agents
 */
export async function openImportDialog(
  onImport: (agents: Agent[], errors: string[]) => void,
  scope: AgentScope = AgentScope.Global,
  acceptZip: boolean = true,
  acceptMd: boolean = true
): Promise<void> {
  try {
    const filters: { name: string; extensions: string[] }[] = [];

    if (acceptZip && acceptMd) {
      filters.push({ name: 'Agent Files', extensions: ['md', 'zip'] });
    } else if (acceptZip) {
      filters.push({ name: 'ZIP Files', extensions: ['zip'] });
    } else if (acceptMd) {
      filters.push({ name: 'Markdown Files', extensions: ['md'] });
    }

    const selected = await open({
      multiple: false,
      filters,
    });

    if (!selected) {
      return; // User cancelled
    }

    const filePath = selected as string;
    const agents: Agent[] = [];
    const errors: string[] = [];

    try {
      if (filePath.endsWith('.zip')) {
        const result = await importAgentsFromZipPath(filePath, scope);
        agents.push(...result.agents);
        errors.push(...result.errors);
      } else if (filePath.endsWith('.md')) {
        try {
          const agent = await importAgentFromPath(filePath, scope);
          if (agent) {
            agents.push(agent);
          }
        } catch (error) {
          errors.push(`${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      onImport(agents, errors);
    } catch (error) {
      errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      onImport([], errors);
    }
  } catch (error) {
    console.error('Dialog error:', error);
    onImport([], [`Dialog error: ${error instanceof Error ? error.message : 'Unknown error'}`]);
  }
}
