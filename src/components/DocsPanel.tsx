import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { openUrl } from '@tauri-apps/plugin-opener';
import { CloseIcon } from './icons/CloseIcon';

interface DocsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DocSection {
  id: string;
  title: string;
  content: React.ReactNode;
}

const docSections: DocSection[] = [
  {
    id: 'subagents',
    title: 'Subagents',
    content: (
      <>
        <p className="mb-3">
          Subagents are custom AI personas you can create for Claude Code. Each agent has its own
          personality, instructions, and tool permissions that shape how Claude behaves when you
          invoke that agent.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Key Concepts</h4>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Name:</strong> How you'll reference the agent (e.g., "code-reviewer")</li>
          <li><strong>Description:</strong> Brief summary shown in agent lists</li>
          <li><strong>Model:</strong> Which Claude model to use (Sonnet, Haiku, Opus, or inherit from parent)</li>
          <li><strong>Tools:</strong> Which capabilities the agent can use (Read, Edit, Bash, etc.)</li>
          <li><strong>Body:</strong> The system prompt defining the agent's behavior</li>
        </ul>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Usage in Claude Code</h4>
        <p className="mb-2">
          Once created, invoke your agent in Claude Code by typing:
        </p>
        <code className="block bg-v-light-hover dark:bg-v-light-dark px-3 py-2 rounded text-sm font-mono mb-3">
          @agent-name your prompt here
        </code>
        <p>
          Agents are stored as markdown files in <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">.claude/agents/</code>
        </p>
      </>
    ),
  },
  {
    id: 'skills',
    title: 'Skills',
    content: (
      <>
        <p className="mb-3">
          Skills are reusable capability modules that extend what Claude Code can do. They're
          essentially mini-agents that can be invoked for specific tasks.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Structure</h4>
        <p className="mb-2">
          Each skill is a folder containing a <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">SKILL.md</code> file
          with frontmatter metadata and instructions:
        </p>
        <pre className="bg-v-light-hover dark:bg-v-light-dark px-3 py-2 rounded text-sm font-mono mb-3 overflow-x-auto">
{`---
name: my-skill
description: What this skill does
allowedTools:
  - Read
  - Grep
---

Skill instructions here...`}
        </pre>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Assets</h4>
        <p>
          Skills can include additional files (templates, configs, etc.) in the same folder
          that the skill can reference during execution.
        </p>
      </>
    ),
  },
  {
    id: 'commands',
    title: 'Slash Commands',
    content: (
      <>
        <p className="mb-3">
          Slash commands are custom shortcuts that expand into longer prompts. They help you
          quickly invoke common workflows without typing the full instructions each time.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Creating Commands</h4>
        <p className="mb-2">
          Each command is a markdown file in <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">.claude/commands/</code>.
          The filename becomes the command name.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Usage</h4>
        <p className="mb-2">
          In Claude Code, type a forward slash followed by the command name:
        </p>
        <code className="block bg-v-light-hover dark:bg-v-light-dark px-3 py-2 rounded text-sm font-mono mb-3">
          /my-command
        </code>
        <p>
          The command's content will be expanded and sent to Claude as if you typed it directly.
        </p>
      </>
    ),
  },
  {
    id: 'memory',
    title: 'Memory (CLAUDE.md)',
    content: (
      <>
        <p className="mb-3">
          CLAUDE.md files provide persistent context that Claude Code reads at the start of
          every conversation. Use them to store project-specific instructions, coding standards,
          or important context.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">What to Include</h4>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>Project overview and architecture</li>
          <li>Coding conventions and style guides</li>
          <li>Important file locations</li>
          <li>Common commands and workflows</li>
          <li>Team-specific preferences</li>
        </ul>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Scope</h4>
        <p>
          Global memory (<code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">~/.claude/CLAUDE.md</code>) applies
          to all projects. Project memory (<code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">.claude/CLAUDE.md</code>)
          applies only to that project.
        </p>
      </>
    ),
  },
  {
    id: 'mcp',
    title: 'MCP Servers',
    content: (
      <>
        <p className="mb-3">
          MCP (Model Context Protocol) servers extend Claude Code's capabilities by connecting
          to external services and data sources. They allow Claude to interact with databases,
          APIs, and other systems.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Transport Types</h4>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>stdio:</strong> Local process that communicates via stdin/stdout</li>
          <li><strong>HTTP:</strong> Remote server accessed via HTTP requests</li>
          <li><strong>SSE:</strong> Server-sent events for streaming responses</li>
        </ul>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Common Servers</h4>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>GitHub:</strong> Access repositories, issues, and PRs</li>
          <li><strong>Filesystem:</strong> Extended file operations</li>
          <li><strong>PostgreSQL:</strong> Database queries and management</li>
        </ul>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Configuration</h4>
        <p>
          MCP servers are configured in <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">~/.claude/mcp.json</code> (user)
          or <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">.mcp.json</code> (project).
        </p>
      </>
    ),
  },
  {
    id: 'hooks',
    title: 'Hooks',
    content: (
      <>
        <p className="mb-3">
          Hooks let you run custom shell commands at specific points in Claude Code's execution.
          Use them for logging, validation, notifications, or automated workflows.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Event Types</h4>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>PreToolUse:</strong> Before Claude executes a tool (can block execution)</li>
          <li><strong>PostToolUse:</strong> After a tool completes</li>
          <li><strong>Notification:</strong> When Claude sends a notification</li>
          <li><strong>Stop:</strong> When Claude stops execution</li>
          <li><strong>SubagentStop:</strong> When a subagent completes</li>
        </ul>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Hook Configuration</h4>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li><strong>Matcher:</strong> Optional pattern to filter which events trigger the hook</li>
          <li><strong>Command:</strong> Shell command to execute</li>
          <li><strong>Timeout:</strong> Maximum execution time in milliseconds</li>
        </ul>
        <p>
          Hooks are stored in <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">~/.claude/settings.json</code> or
          project-level <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">.claude/settings.json</code>.
        </p>
      </>
    ),
  },
  {
    id: 'scopes',
    title: 'Scopes (Global vs Project)',
    content: (
      <>
        <p className="mb-3">
          Vinsly manages resources at two scope levels, allowing you to share some configurations
          globally while keeping others project-specific.
        </p>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Global Scope</h4>
        <p className="mb-3">
          Resources in <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">~/.claude/</code> are available
          across all projects. Use global scope for:
        </p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>General-purpose agents you use everywhere</li>
          <li>Personal coding preferences</li>
          <li>Universal MCP server connections</li>
        </ul>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Project Scope</h4>
        <p className="mb-3">
          Resources in <code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">.claude/</code> within a project
          directory are specific to that project. Use project scope for:
        </p>
        <ul className="list-disc list-inside space-y-1 mb-3">
          <li>Project-specific agents and workflows</li>
          <li>Team-shared configurations (can be committed to git)</li>
          <li>Project-specific MCP servers</li>
        </ul>
        <h4 className="font-medium mb-2 text-v-light-text-primary dark:text-v-text-primary">Local Scope</h4>
        <p>
          Some configurations also support a "local" scope (<code className="text-sm bg-v-light-hover dark:bg-v-light-dark px-1 rounded">.claude/settings.local.json</code>)
          for sensitive settings that shouldn't be committed to version control.
        </p>
      </>
    ),
  },
];

export const DocsPanel: React.FC<DocsPanelProps> = ({ isOpen, onClose }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/30 dark:bg-black/50 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
            className="fixed top-0 right-0 h-full w-full max-w-lg bg-v-light-surface dark:bg-v-mid-dark border-l border-v-light-border dark:border-v-border shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-v-light-border dark:border-v-border flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Documentation
                </h2>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-0.5">
                  Learn about Claude Code features
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary transition-colors"
                aria-label="Close documentation"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4 space-y-2">
                {docSections.map((section) => (
                  <div
                    key={section.id}
                    className="border border-v-light-border dark:border-v-border rounded-lg overflow-hidden"
                  >
                    {/* Section Header */}
                    <button
                      onClick={() => toggleSection(section.id)}
                      className="w-full px-4 py-3 flex items-center justify-between bg-v-light-bg dark:bg-v-dark hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors text-left"
                    >
                      <span className="font-medium text-v-light-text-primary dark:text-v-text-primary">
                        {section.title}
                      </span>
                      <motion.svg
                        animate={{ rotate: expandedSection === section.id ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                        className="h-5 w-5 text-v-light-text-secondary dark:text-v-text-secondary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </button>

                    {/* Section Content */}
                    <AnimatePresence>
                      {expandedSection === section.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 py-4 text-sm text-v-light-text-secondary dark:text-v-text-secondary border-t border-v-light-border dark:border-v-border bg-v-light-surface dark:bg-v-mid-dark">
                            {section.content}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark flex-shrink-0">
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
                For more details, visit the{' '}
                <button
                  onClick={async () => {
                    const url = 'https://docs.anthropic.com/en/docs/claude-code/overview';
                    try {
                      await openUrl(url);
                    } catch (error) {
                      console.error('Failed to open URL with Tauri:', error);
                      // Fallback to window.open
                      window.open(url, '_blank');
                    }
                  }}
                  className="text-v-accent hover:underline cursor-pointer"
                >
                  Claude Code documentation
                </button>
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
