import JSZip from 'jszip';
import { Agent } from '../types';
import { save } from '@tauri-apps/plugin-dialog';
import { exportTextFile, exportBinaryFile } from './tauriCommands';
import { serializeFrontmatter } from './frontmatter';

/**
 * Convert an agent to markdown format with frontmatter
 */
export function agentToMarkdown(agent: Agent): string {
  const frontmatterYaml = serializeFrontmatter(agent.frontmatter);
  const body = agent.body || '';
  return `---\n${frontmatterYaml}\n---\n\n${body}`;
}

/**
 * Export a single agent as a .md file using Tauri save dialog
 * Returns true if export was successful, false if cancelled
 */
export async function exportAgent(agent: Agent): Promise<boolean> {
  try {
    const markdown = agentToMarkdown(agent);

    const filePath = await save({
      defaultPath: `${agent.name}.md`,
      filters: [{
        name: 'Markdown',
        extensions: ['md']
      }]
    });

    if (filePath) {
      await exportTextFile(filePath, markdown);
      return true;
    }
    return false; // User cancelled
  } catch (error) {
    console.error('Error exporting agent:', error);
    throw error;
  }
}

/**
 * Export multiple agents as a .zip bundle using Tauri save dialog
 * Returns true if export was successful, false if cancelled
 */
export async function exportAgentsAsZip(agents: Agent[], zipName: string = 'agents'): Promise<boolean> {
  try {
    const zip = new JSZip();

    agents.forEach(agent => {
      const markdown = agentToMarkdown(agent);
      zip.file(`${agent.name}.md`, markdown);
    });

    const filePath = await save({
      defaultPath: `${zipName}.zip`,
      filters: [{
        name: 'ZIP Archive',
        extensions: ['zip']
      }]
    });

    if (filePath) {
      const zipBlob = await zip.generateAsync({ type: 'uint8array' });
      await exportBinaryFile(filePath, Array.from(zipBlob));
      return true;
    }
    return false; // User cancelled
  } catch (error) {
    console.error('Error exporting agents as ZIP:', error);
    throw error;
  }
}
