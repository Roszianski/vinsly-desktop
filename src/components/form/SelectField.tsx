import React from 'react';
import { WarningIcon } from '../icons/WarningIcon';

interface SelectFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  warning?: string;
  name?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  id,
  value,
  onChange,
  children,
  hint,
  error,
  warning,
  name
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary mb-1">
      {label}
    </label>
    <select
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className={`w-full bg-v-light-bg dark:bg-v-dark border ${error ? 'border-v-danger' : 'border-v-light-border dark:border-v-border'} text-v-light-text-primary dark:text-v-text-primary px-3 py-2 focus:ring-2 focus:ring-v-accent focus:outline-none focus:border-v-accent transition duration-150 ease-in-out rounded-md`}
    >
      {children}
    </select>
    {hint && !error && !warning && (
      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">{hint}</p>
    )}
    {warning && !error && (
      <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1 flex items-center gap-1">
        <WarningIcon className="h-3 w-3" /> {warning}
      </p>
    )}
    {error && (
      <p className="text-xs text-v-danger mt-1 flex items-center gap-1">
        <WarningIcon className="h-3 w-3" /> {error}
      </p>
    )}
  </div>
);
