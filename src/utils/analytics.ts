import { Agent, AgentModel, Tool, ToolCategory } from '../types';
import { AVAILABLE_TOOLS } from '../constants';
import { getToolsState, toolsValueToArray } from './toolHelpers';

export interface ModelDistribution {
  model: string;
  count: number;
  percentage: number;
}

export interface ToolCategoryBreakdown {
  category: ToolCategory | 'All Tools';
  count: number;
  percentage: number;
}

export interface ComplexityScore {
  agentId: string;
  agentName: string;
  score: number;
  level: 'simple' | 'moderate' | 'complex';
  promptLength: number;
  toolCount: number;
  inheritsAllTools: boolean;
}

export interface Recommendation {
  type: 'performance' | 'organization' | 'security';
  agentId: string;
  agentName: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// Calculate model distribution across all agents
export const calculateModelDistribution = (agents: Agent[]): ModelDistribution[] => {
  const modelCounts: Record<string, number> = {};

  agents.forEach(agent => {
    const model = agent.frontmatter.model || 'default';
    modelCounts[model] = (modelCounts[model] || 0) + 1;
  });

  const total = agents.length;

  return Object.entries(modelCounts).map(([model, count]) => ({
    model: model.charAt(0).toUpperCase() + model.slice(1),
    count,
    percentage: Math.round((count / total) * 100)
  }));
};

// Parse tools string and get tool breakdown by category
const TOOL_CATEGORY_ORDER: (ToolCategory | 'All Tools')[] = [
  'All Tools',
  'Read-only',
  'Edit',
  'Execution',
  'Other'
];

export const calculateToolsBreakdown = (agents: Agent[]): ToolCategoryBreakdown[] => {
  const categoryCounts: Record<ToolCategory | 'All Tools', number> = {
    'Read-only': 0,
    'Edit': 0,
    'Execution': 0,
    'Other': 0,
    'All Tools': 0
  };

  let totalAgentToolConfigs = 0;

  agents.forEach(agent => {
    const toolsState = getToolsState(agent.frontmatter.tools);

    if (toolsState.inheritsAll) {
      categoryCounts['All Tools']++;
      totalAgentToolConfigs++;
      return;
    }

    toolsState.list.forEach(toolName => {
      const tool = AVAILABLE_TOOLS.find(t => t.name === toolName);
      if (tool) {
        categoryCounts[tool.category]++;
      }
    });
    totalAgentToolConfigs++;
  });

  return TOOL_CATEGORY_ORDER.map(category => ({
    category,
    count: categoryCounts[category],
    percentage: totalAgentToolConfigs > 0 ? Math.round((categoryCounts[category] / totalAgentToolConfigs) * 100) : 0
  }));
};

const INHERITED_TOOL_COMPLEXITY_WEIGHT = Math.max(4, Math.round(AVAILABLE_TOOLS.length * 0.4)); // Treat inherited access as mid-level complexity

// Calculate complexity score for each agent
// Formula: (toolWeight * 10) + (promptLength / 50)
export const calculateComplexityScores = (agents: Agent[]): ComplexityScore[] => {
  return agents.map(agent => {
    const promptLength = agent.body.length;

    const toolsState = getToolsState(agent.frontmatter.tools);
    const inheritsAllTools = toolsState.inheritsAll;

    const explicitToolCount = inheritsAllTools ? 0 : toolsState.list.length;

    const effectiveToolCount = inheritsAllTools
      ? INHERITED_TOOL_COMPLEXITY_WEIGHT
      : explicitToolCount;

    const score = (effectiveToolCount * 10) + (promptLength / 50);

    let level: 'simple' | 'moderate' | 'complex';
    if (score < 200) {
      level = 'simple';
    } else if (score < 500) {
      level = 'moderate';
    } else {
      level = 'complex';
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      score: Math.round(score),
      level,
      promptLength,
      toolCount: inheritsAllTools ? INHERITED_TOOL_COMPLEXITY_WEIGHT : explicitToolCount,
      inheritsAllTools
    };
  }).sort((a, b) => b.score - a.score); // Sort by highest complexity first
};

// Generate actionable recommendations based on agent analysis
export const generateRecommendations = (agents: Agent[]): Recommendation[] => {
  const recommendations: Recommendation[] = [];
  const complexityScores = calculateComplexityScores(agents);
  const nameCounts = agents.reduce<Record<string, number>>((acc, agent) => {
    const key = (agent.frontmatter.name || agent.name || '').trim().toLowerCase();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  // Check for overly complex agents (long prompts)
  complexityScores.forEach(score => {
    if (score.promptLength > 2000) {
      recommendations.push({
        type: 'performance',
        agentId: score.agentId,
        agentName: score.agentName,
        message: `Has ${score.promptLength} character prompt. Make more concise for better performance.`,
        severity: 'high'
      });
    } else if (score.promptLength > 1000) {
      recommendations.push({
        type: 'performance',
        agentId: score.agentId,
        agentName: score.agentName,
        message: `Has ${score.promptLength} character prompt. Consider simplifying for clarity.`,
        severity: 'medium'
      });
    }
  });

  // Check for agents with too many tools
  complexityScores.forEach(score => {
    if (!score.inheritsAllTools && score.toolCount > 8) {
      recommendations.push({
        type: 'security',
        agentId: score.agentId,
        agentName: score.agentName,
        message: `Has access to ${score.toolCount} tools. Consider limiting to only necessary tools.`,
        severity: 'medium'
      });
    }
  });

  // Check if there are many agents - suggest organization
  if (agents.length >= 10) {
    const projectAgents = agents.filter(a => a.scope === 'Project').length;
    const globalAgents = agents.filter(a => a.scope === 'Global').length;

    if (projectAgents === 0 && globalAgents >= 10) {
      recommendations.push({
        type: 'organization',
        agentId: 'all',
        agentName: 'All agents',
        message: `You have ${globalAgents} global agents. Consider organizing some as project-specific agents.`,
        severity: 'low'
      });
    }
  }

  // Check for agents with high-risk tools but simple prompts
  agents.forEach(agent => {
    const toolList = toolsValueToArray(agent.frontmatter.tools);
    const hasHighRiskTools = toolList.includes('Bash') || toolList.includes('WebFetch');
    const hasShortPrompt = agent.body.length < 200;

    if (hasHighRiskTools && hasShortPrompt) {
      recommendations.push({
        type: 'security',
        agentId: agent.id,
        agentName: agent.name,
        message: `Has high-risk tools (Bash/WebFetch) with minimal safety instructions. Add clear usage guidelines.`,
        severity: 'high'
      });
    }
  });

  // Check for duplicated agent identifiers
  agents.forEach(agent => {
    const normalizedName = (agent.frontmatter.name || agent.name || '').trim().toLowerCase();
    if (normalizedName && nameCounts[normalizedName] > 1) {
      recommendations.push({
        type: 'organization',
        agentId: agent.id,
        agentName: agent.name,
        message: `Shares the same identifier as another agent. Anthropics recommends unique, job-focused names so Claude can route work reliably.`,
        severity: 'medium'
      });
    }
  });

  // Description quality checks inspired by Anthropic sub-agent guidelines
  agents.forEach(agent => {
    const description = (agent.frontmatter.description || '').trim();
    const descriptionLower = description.toLowerCase();

    if (!description) {
      recommendations.push({
        type: 'organization',
        agentId: agent.id,
        agentName: agent.name,
        message: `Missing delegation description. Anthropic suggests starting with “Use this agent when…” so Claude knows when to hand work to it.`,
        severity: 'high'
      });
      return;
    }

    if (description.length < 60) {
      recommendations.push({
        type: 'organization',
        agentId: agent.id,
        agentName: agent.name,
        message: `Description is only ${description.length} characters. Provide triggers, inputs, and exclusions so Claude can delegate with confidence.`,
        severity: 'medium'
      });
    }

    if (!descriptionLower.includes('use this agent when')) {
      recommendations.push({
        type: 'organization',
        agentId: agent.id,
        agentName: agent.name,
        message: `Consider rewriting the description to begin with “Use this agent when…”. That phrasing mirrors Anthropic’s recommended template for routing.`,
        severity: 'low'
      });
    }
  });

  // Tool inheritance without guardrails
  complexityScores.forEach(score => {
    if (score.inheritsAllTools && score.score > 350) {
      recommendations.push({
        type: 'security',
        agentId: score.agentId,
        agentName: score.agentName,
        message: `Inherits every tool and has a detailed prompt. Anthropic advises explicitly listing required tools for narrower blast radius.`,
        severity: 'medium'
      });
    }
  });

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
};

// Calculate summary statistics
export interface AnalyticsSummary {
  totalAgents: number;
  globalAgents: number;
  projectAgents: number;
  averageComplexity: number;
  mostUsedModel: string;
  toolCategories: number;
}

export const calculateAnalyticsSummary = (agents: Agent[]): AnalyticsSummary => {
  const modelDist = calculateModelDistribution(agents);
  const complexityScores = calculateComplexityScores(agents);

  const avgComplexity = complexityScores.length > 0
    ? Math.round(complexityScores.reduce((sum, s) => sum + s.score, 0) / complexityScores.length)
    : 0;

  const mostUsed = modelDist.reduce((prev, current) =>
    current.count > prev.count ? current : prev
  , modelDist[0] || { model: 'Unknown', count: 0 });

  return {
    totalAgents: agents.length,
    globalAgents: agents.filter(a => a.scope === 'Global').length,
    projectAgents: agents.filter(a => a.scope === 'Project').length,
    averageComplexity: avgComplexity,
    mostUsedModel: mostUsed.model,
    toolCategories: 4 // Fixed: Read-only, Edit, Execution, Other
  };
};
