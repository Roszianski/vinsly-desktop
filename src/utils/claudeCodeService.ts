/**
 * Claude Code CLI Integration Service
 *
 * This service handles automatic agent generation via Claude Code's headless mode.
 * It constructs prompts, invokes Claude Code, and parses the responses.
 */

import { AgentScope, AgentModel } from '../types';
import { invokeClaudeCode, ClaudeCodeInvocationResult } from './tauriCommands';
import { AVAILABLE_TOOLS, AVAILABLE_COLORS } from '../constants';
import { devLog } from './devLogger';

// ============================================================================
// Types
// ============================================================================

export interface GeneratedAgentFields {
  name: string;
  description: string;
  systemPrompt: string;
  model?: AgentModel;
  tools?: string[];
  color?: string;
}

export interface AgentGenerationResult {
  success: boolean;
  fields?: GeneratedAgentFields;
  error?: string;
  rawOutput?: string;
}

// ============================================================================
// Constants
// ============================================================================

const AVAILABLE_TOOL_NAMES = AVAILABLE_TOOLS.map((t) => t.name);

// ============================================================================
// Prompt Construction
// ============================================================================

/**
 * Construct the prompt for Claude Code to generate an agent definition
 */
function buildAgentGenerationPrompt(
  userDescription: string,
  scope: AgentScope
): string {
  const scopeDescription =
    scope === AgentScope.Global
      ? 'Global (available in all projects)'
      : 'Project-specific';

  return `You are helping create a Claude Code agent definition. Based on the user's description, generate a complete agent definition.

USER'S DESCRIPTION:
${userDescription}

AGENT SCOPE: ${scopeDescription}

Generate a JSON object with these fields:
- name: lowercase identifier with hyphens only (e.g., "code-reviewer", "test-writer")
- description: A clear description starting with "Use this agent when..." that tells Claude when to delegate to this agent (40+ characters recommended)
- systemPrompt: Comprehensive instructions for the agent (include role definition, specific behaviors, examples if helpful)
- model: One of "default" (Sonnet - recommended), "opus" (most capable), "haiku" (fast/light), or "inherit" (use parent's model)
- tools: Array of tool names to allow, or null to inherit all tools. Available tools: ${AVAILABLE_TOOL_NAMES.join(', ')}
- color: Optional UI color, one of: ${AVAILABLE_COLORS.join(', ')}

Choose tools based on what the agent needs:
- Read-only tasks: Read, Grep, Glob, WebSearch, AskUserQuestion
- File editing: Edit, Write, NotebookEdit, workflow
- System commands: Bash, WebFetch (higher risk)

IMPORTANT: Respond with ONLY the JSON object, no markdown code blocks, no explanation.

Example response format:
{
  "name": "code-reviewer",
  "description": "Use this agent when you need thorough code review for quality, security, and best practices.",
  "systemPrompt": "You are a senior software engineer performing code review...",
  "model": "default",
  "tools": ["Read", "Grep", "Glob", "AskUserQuestion"],
  "color": "blue"
}`;
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse the Claude Code response into agent fields
 */
function parseAgentResponse(output: string): GeneratedAgentFields | null {
  try {
    // Try to parse the output as JSON directly
    let parsed: Record<string, unknown>;

    // First try direct JSON parse
    try {
      parsed = JSON.parse(output.trim());
    } catch {
      // Try to extract JSON from the output (in case there's extra text)
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        devLog.error('No JSON found in Claude Code output');
        return null;
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Validate required fields
    if (typeof parsed.name !== 'string' || !parsed.name.trim()) {
      devLog.error('Missing or invalid name field');
      return null;
    }

    if (typeof parsed.description !== 'string' || !parsed.description.trim()) {
      devLog.error('Missing or invalid description field');
      return null;
    }

    if (typeof parsed.systemPrompt !== 'string') {
      devLog.error('Missing or invalid systemPrompt field');
      return null;
    }

    // Normalize name to lowercase with hyphens
    const name = parsed.name
      .toLowerCase()
      .replace(/[^a-z-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Validate and normalize model
    let model: AgentModel | undefined;
    if (parsed.model && typeof parsed.model === 'string') {
      const modelLower = parsed.model.toLowerCase();
      const validModels = ['default', 'opus', 'haiku', 'inherit', 'sonnet'];
      if (validModels.includes(modelLower)) {
        // Map 'sonnet' to 'default' and 'default' to undefined (will use Sonnet)
        if (modelLower === 'sonnet' || modelLower === 'default') {
          model = undefined; // Will default to Sonnet
        } else {
          model = modelLower as AgentModel;
        }
      }
    }

    // Validate and normalize tools
    let tools: string[] | undefined;
    if (Array.isArray(parsed.tools)) {
      tools = parsed.tools.filter(
        (t): t is string =>
          typeof t === 'string' && AVAILABLE_TOOL_NAMES.includes(t)
      );
      if (tools.length === 0) {
        tools = undefined; // Inherit all if none valid
      }
    } else if (parsed.tools === null) {
      tools = undefined; // Explicitly inherit all
    }

    // Validate color
    let color: string | undefined;
    if (typeof parsed.color === 'string' && AVAILABLE_COLORS.includes(parsed.color)) {
      color = parsed.color;
    }

    return {
      name,
      description: parsed.description.trim(),
      systemPrompt: parsed.systemPrompt.trim(),
      model,
      tools,
      color,
    };
  } catch (error) {
    devLog.error('Failed to parse Claude Code output:', error);
    return null;
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Generate an agent using Claude Code headless mode
 *
 * @param userDescription - The user's natural language description of the agent
 * @param scope - Whether the agent is global or project-specific
 * @returns Result containing the generated agent fields or an error
 */
export async function generateAgentWithClaudeCode(
  userDescription: string,
  scope: AgentScope
): Promise<AgentGenerationResult> {
  try {
    // Validate input
    if (!userDescription.trim()) {
      return {
        success: false,
        error: 'Please provide a description of the agent you want to create.',
      };
    }

    // Build the prompt
    const prompt = buildAgentGenerationPrompt(userDescription, scope);

    devLog.log('Invoking Claude Code with prompt length:', prompt.length);

    // Invoke Claude Code
    const result: ClaudeCodeInvocationResult = await invokeClaudeCode(prompt);

    devLog.log('Claude Code result:', {
      success: result.success,
      outputLength: result.output?.length,
      error: result.error,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Claude Code invocation failed',
        rawOutput: result.output,
      };
    }

    // Parse the response
    const fields = parseAgentResponse(result.output);

    if (!fields) {
      return {
        success: false,
        error:
          'Failed to parse agent definition from Claude Code response. The response may not have been valid JSON.',
        rawOutput: result.output,
      };
    }

    return {
      success: true,
      fields,
      rawOutput: result.output,
    };
  } catch (error) {
    devLog.error('Error generating agent with Claude Code:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
