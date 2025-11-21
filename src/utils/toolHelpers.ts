import { Agent } from '../types';

export type ToolsValue = Agent['frontmatter']['tools'];

export interface ToolsState {
  inheritsAll: boolean;
  explicitNone: boolean;
  list: string[];
}

export const toolsValueToArray = (value: ToolsValue): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((tool) => `${tool}`.trim())
      .filter((tool) => tool.length > 0);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((tool) => tool.trim())
      .filter((tool) => tool.length > 0);
  }

  return [];
};

export const getToolsState = (value: ToolsValue): ToolsState => {
  const inheritsAll = value === undefined;
  const list = inheritsAll ? [] : toolsValueToArray(value);
  return {
    inheritsAll,
    explicitNone: !inheritsAll && list.length === 0,
    list,
  };
};

export const toolsSelectionToValue = (
  selection: string[],
  previous: ToolsValue,
  totalAvailable: number
): ToolsValue => {
  if (selection.length === totalAvailable) {
    return undefined;
  }

  if (selection.length === 0) {
    return Array.isArray(previous) ? [] : '';
  }

  return Array.isArray(previous) ? selection : selection.join(',');
};

export const emptyToolsValue = (previous: ToolsValue): ToolsValue =>
  Array.isArray(previous) ? [] : '';
