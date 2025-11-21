import React from 'react';
import { WarningIcon } from '../icons/WarningIcon';

interface TextareaFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  hint?: string;
  warning?: string;
  rows?: number;
  name?: string;
  placeholder?: string;
}

export const TextareaField: React.FC<TextareaFieldProps> = ({
  label,
  id,
  value,
  onChange,
  hint,
  warning,
  rows = 10,
  name,
  placeholder
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary mb-1">
      {label}
    </label>
    <textarea
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className="w-full bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary px-3 py-2 focus:ring-2 focus:ring-v-accent focus:outline-none focus:border-v-accent transition duration-150 ease-in-out font-sans text-sm custom-scrollbar rounded-md placeholder:text-v-light-text-secondary/50 dark:placeholder:text-v-text-secondary/50 placeholder:italic"
    />
    {hint && !warning && (
      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">{hint}</p>
    )}
    {warning && (
      <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1 flex items-center gap-1">
        <WarningIcon className="h-3 w-3" /> {warning}
      </p>
    )}
  </div>
);
