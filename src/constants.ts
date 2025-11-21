
import { Agent, AgentScope, AgentModel, Tool, ToolRisk, ToolCategory } from './types';

export const MOCK_AGENTS: Agent[] = [
  {
    id: '.claude/agents/code-reviewer.md',
    name: 'code-reviewer',
    scope: AgentScope.Project,
    path: '.claude/agents/code-reviewer.md',
    isFavorite: true,
    frontmatter: {
      name: 'code-reviewer',
      description: 'Use this agent to review code for quality, style, and potential bugs. It can suggest improvements and enforce coding standards.',
      model: 'sonnet',
      tools: 'Read,Grep,AskUserQuestion',
      color: 'blue'
    },
    body: 'You are a senior software engineer performing a code review. Be thorough, constructive, and clear in your feedback. Focus on best practices, performance, and readability. Do not approve code with obvious issues.'
  },
  {
    id: '.claude/agents/tech-lead.md',
    name: 'tech-lead',
    scope: AgentScope.Project,
    path: '.claude/agents/tech-lead.md',
    frontmatter: {
      name: 'tech-lead',
      description: 'Use this agent for high-level architectural decisions, planning, and task breakdown. It understands system design and can delegate to other agents.',
      model: 'opus', // read-only model
      tools: 'AskUserQuestion,workflow'
    },
    body: 'As a tech lead, your role is to guide the project\'s technical direction. Provide clear, high-level guidance. Break down complex problems into smaller, manageable tasks for the team.'
  },
  {
    id: '~/.claude/agents/file-organizer.md',
    name: 'file-organizer',
    scope: AgentScope.Global,
    path: '~/.claude/agents/file-organizer.md',
    frontmatter: {
      name: 'file-organizer',
      description: 'A general-purpose agent to organize files, create directories, and clean up workspaces.',
      model: 'haiku',
      // tools omitted to inherit all
      color: 'green',
      "custom-field": "some-value"
    },
    body: 'You are a helpful assistant that organizes files. When asked to organize a directory, create logical subdirectories and move files accordingly. Always confirm before deleting anything.'
  },
  {
    id: '~/.claude/agents/shell-expert.md',
    name: 'shell-expert',
    scope: AgentScope.Global,
    path: '~/.claude/agents/shell-expert.md',
    isFavorite: false,
    frontmatter: {
      name: 'shell-expert',
      description: 'Executes shell commands to perform complex system tasks. Use with caution.',
      model: 'inherit',
      tools: 'Bash,WebFetch,Read,Grep,Glob,Edit',
      color: 'red'
    },
    body: 'You are a shell expert. You can execute any bash command. Prioritize safety and ask for confirmation for any potentially destructive operations.'
  },
];

export const AVAILABLE_MODELS: AgentModel[] = ['sonnet', 'haiku', 'opus', 'inherit'];

export const AVAILABLE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'cyan'];

export const AVAILABLE_TOOLS: Tool[] = [
  { name: 'Read', category: 'Read-only', risk: ToolRisk.Low },
  { name: 'Grep', category: 'Read-only', risk: ToolRisk.Low },
  { name: 'Glob', category: 'Read-only', risk: ToolRisk.Low },
  { name: 'WebSearch', category: 'Read-only', risk: ToolRisk.Low },
  { name: 'AskUserQuestion', category: 'Read-only', risk: ToolRisk.Low },
  { name: 'Edit', category: 'Edit', risk: ToolRisk.Medium },
  { name: 'Write', category: 'Edit', risk: ToolRisk.Medium },
  { name: 'NotebookEdit', category: 'Edit', risk: ToolRisk.Medium },
  { name: 'workflow', category: 'Edit', risk: ToolRisk.Medium },
  { name: 'Bash', category: 'Execution', risk: ToolRisk.High },
  { name: 'WebFetch', category: 'Execution', risk: ToolRisk.High },
  { name: 'SomeOtherTool', category: 'Other', risk: ToolRisk.Unknown },
];
