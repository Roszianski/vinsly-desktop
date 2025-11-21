import React, { useState } from 'react';
import { Tool, ToolCategory, ToolRisk } from '../../types';
import { CategoryCheckbox } from './CategoryCheckbox';
import { RiskBadge } from './RiskBadge';

interface CategoryState {
  checked: boolean;
  indeterminate?: boolean;
}

interface ToolsSelectorProps {
  toolsSummaryLabel: string;
  categoryStates: Record<string | ToolCategory, CategoryState>;
  handleAllToolsToggle: (checked: boolean) => void;
  toolCategoryOrder: ToolCategory[];
  handleCategoryToggle: (category: ToolCategory, checked: boolean) => void;
  overallRisk: ToolRisk;
  riskSummaryText: string;
  toolCategories: Record<ToolCategory, Tool[]>;
  selectedTools: Set<string>;
  handleToolsChange: (toolName: string, isSelected: boolean) => void;
}

export const ToolsSelector: React.FC<ToolsSelectorProps> = ({
  toolsSummaryLabel,
  categoryStates,
  handleAllToolsToggle,
  toolCategoryOrder,
  handleCategoryToggle,
  overallRisk,
  riskSummaryText,
  toolCategories,
  selectedTools,
  handleToolsChange
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<ToolCategory>>(new Set());

  const toggleCategory = (category: ToolCategory) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="space-y-2">
          <CategoryCheckbox
            id="tool-cat-all"
            label="All tools"
            description="Inherit every available tool"
            checked={categoryStates.all?.checked || false}
            indeterminate={categoryStates.all?.indeterminate}
            onChange={handleAllToolsToggle}
          />
          {toolCategoryOrder.map((category) => (
            <CategoryCheckbox
              key={category}
              id={`tool-cat-${category}`}
              label={category}
              description={`Toggle every ${category.toLowerCase()} tool`}
              checked={categoryStates[category]?.checked || false}
              indeterminate={categoryStates[category]?.indeterminate}
              onChange={(checked) => handleCategoryToggle(category, checked)}
            />
          ))}
        </div>

        <div className="flex flex-col gap-1 text-xs px-4 py-2 bg-v-light-surface dark:bg-v-mid-dark border-l-2 border-v-accent">
          <span className="text-v-light-text-primary dark:text-v-text-primary font-medium">{toolsSummaryLabel}</span>
          <div className="flex items-center gap-2 text-v-light-text-secondary dark:text-v-text-secondary">
            <RiskBadge risk={overallRisk} />
            <span>{riskSummaryText}</span>
          </div>
        </div>
      </div>

      <div className="border border-v-light-border dark:border-v-border bg-v-light-surface dark:bg-v-mid-dark space-y-0 max-h-80 overflow-y-auto custom-scrollbar">
        {toolCategoryOrder.map((category) => {
          const tools = toolCategories[category] || [];
          if (tools.length === 0) {
            return null;
          }
          const isExpanded = expandedCategories.has(category);
          return (
            <div key={category} className="border-b border-v-light-border dark:border-v-border last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-v-light-text-primary dark:text-v-text-primary">
                    {category}
                  </h4>
                  <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                    ({tools.length} {tools.length === 1 ? 'tool' : 'tools'})
                  </span>
                </div>
                <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                  {tools.filter((tool) => selectedTools.has(tool.name)).length}/{tools.length} selected
                </span>
              </button>
              {isExpanded && (
                <div className="px-4 pb-4 pt-2 space-y-1 bg-v-light-bg dark:bg-v-dark">
                {tools.map((tool) => {
                  const isSelected = selectedTools.has(tool.name);
                  return (
                    <button
                      type="button"
                      key={tool.name}
                      aria-pressed={isSelected}
                      onClick={() => handleToolsChange(tool.name, !isSelected)}
                      className={`w-full flex items-center justify-between px-3 py-2 border text-sm transition-colors ${
                        isSelected
                          ? 'border-v-accent bg-v-accent/5 dark:bg-v-accent/10 text-v-light-text-primary dark:text-v-text-primary'
                          : 'border-transparent hover:border-v-light-border dark:hover:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-4 w-4 border flex items-center justify-center ${
                          isSelected
                            ? 'border-v-accent bg-v-accent'
                            : 'border-v-light-border dark:border-v-border'
                        }`}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="font-mono">{tool.name}</span>
                      </div>
                      <RiskBadge risk={tool.risk} />
                      <span className="sr-only">{isSelected ? 'Selected' : 'Not selected'}</span>
                    </button>
                  );
                })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
