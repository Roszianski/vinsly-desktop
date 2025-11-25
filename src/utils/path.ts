export const extractProjectRootFromAgentPath = (agentPath?: string | null): string | null => {
  if (!agentPath) {
    return null;
  }

  const normalized = agentPath.replace(/\\/g, '/');
  const marker = '/.claude/agents';
  const lowerNormalized = normalized.toLowerCase();
  const markerIndex = lowerNormalized.lastIndexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const root = normalized.slice(0, markerIndex).replace(/\/+$/, '');
  if (!root) {
    return null;
  }

  if (agentPath.includes('\\')) {
    return root.replace(/\//g, '\\');
  }

  return root;
};

export const extractProjectRootFromSkillPath = (skillPath?: string | null): string | null => {
  if (!skillPath) {
    return null;
  }

  const normalized = skillPath.replace(/\\/g, '/');
  const marker = '/.claude/skills';
  const lowerNormalized = normalized.toLowerCase();
  const markerIndex = lowerNormalized.lastIndexOf(marker);

  if (markerIndex === -1) {
    return null;
  }

  const root = normalized.slice(0, markerIndex).replace(/\/+$/, '');
  if (!root) {
    return null;
  }

  if (skillPath.includes('\\')) {
    return root.replace(/\//g, '\\');
  }

  return root;
};
