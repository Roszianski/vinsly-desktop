import React from 'react';
import { CheckIcon } from '../icons/CheckIcon';

interface MultiSelectChipsProps {
  label: string;
  hint?: string;
  options: readonly string[];
  selectedValues: Set<string>;
  onSelectionChange: (newSelection: Set<string>) => void;
  showSelectAll?: boolean;
  columns?: 2 | 3 | 4 | 5 | 6;
  size?: 'sm' | 'md';
}

export const MultiSelectChips: React.FC<MultiSelectChipsProps> = ({
  label,
  hint,
  options,
  selectedValues,
  onSelectionChange,
  showSelectAll = true,
  columns = 4,
  size = 'md',
}) => {
  const allSelected = options.every(opt => selectedValues.has(opt));
  const noneSelected = selectedValues.size === 0;

  const toggleOption = (option: string) => {
    const newSelection = new Set(selectedValues);
    if (newSelection.has(option)) {
      newSelection.delete(option);
    } else {
      newSelection.add(option);
    }
    onSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(options));
    }
  };

  const handleClearAll = () => {
    onSelectionChange(new Set());
  };

  const gridCols: Record<number, string> = {
    2: 'grid-cols-2',
    3: 'grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-5',
    6: 'grid-cols-3 sm:grid-cols-6',
  };

  const chipPadding = size === 'sm' ? 'px-2 py-1' : 'px-3 py-1.5';
  const chipText = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
            {label}
          </label>
          {hint && (
            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-0.5">
              {hint}
            </p>
          )}
        </div>
        {showSelectAll && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs text-v-accent hover:text-v-accent-hover font-medium"
            >
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {!noneSelected && !allSelected && (
              <>
                <span className="text-v-light-text-secondary dark:text-v-text-secondary">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className={`grid ${gridCols[columns]} gap-2`}>
        {options.map((option) => {
          const isSelected = selectedValues.has(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggleOption(option)}
              aria-pressed={isSelected}
              className={`${chipPadding} ${chipText} rounded-lg border font-mono transition-all flex items-center justify-center gap-1.5 ${
                isSelected
                  ? 'border-v-accent bg-v-accent/10 text-v-accent'
                  : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent/50 hover:text-v-light-text-primary dark:hover:text-v-text-primary'
              }`}
            >
              {isSelected && <CheckIcon className="h-3 w-3 flex-shrink-0" />}
              <span className="truncate">{option}</span>
            </button>
          );
        })}
      </div>

      {selectedValues.size > 0 && (
        <div className="p-2 rounded-md bg-v-light-hover dark:bg-v-light-dark border border-v-light-border dark:border-v-border">
          <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mb-1">
            Generated pattern:
          </p>
          <code className="text-xs font-mono text-v-accent break-all">
            {Array.from(selectedValues).join('|')}
          </code>
        </div>
      )}
    </div>
  );
};
