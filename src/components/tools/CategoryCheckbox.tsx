import React, { useRef, useEffect } from 'react';

interface CategoryCheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}

export const CategoryCheckbox: React.FC<CategoryCheckboxProps> = ({
  id,
  label,
  checked,
  indeterminate,
  onChange,
  description
}) => {
  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = Boolean(indeterminate && !checked);
    }
  }, [indeterminate, checked]);

  return (
    <label
      htmlFor={id}
      className={`group relative flex items-center gap-3 px-4 py-2.5 border transition-colors cursor-pointer ${
        checked
          ? 'border-v-accent bg-v-accent/5 dark:bg-v-accent/10'
          : indeterminate && !checked
            ? 'border-v-accent/40 bg-v-accent/5 dark:bg-v-accent/5'
            : 'border-v-light-border dark:border-v-border hover:border-v-accent/40 hover:bg-v-light-hover dark:hover:bg-v-light-dark'
      }`}
    >
      <input
        type="checkbox"
        id={id}
        ref={checkboxRef}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0 rounded"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-0.5">{description}</p>
        )}
      </div>
    </label>
  );
};
