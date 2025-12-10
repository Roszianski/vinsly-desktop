import React from 'react';
import { WarningIcon } from '../icons/WarningIcon';

interface InputFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  warning?: string;
  mono?: boolean;
  name?: string;
  placeholder?: string;
}

export const InputField: React.FC<InputFieldProps> = ({
  label,
  id,
  value,
  onChange,
  onKeyDown,
  required,
  hint,
  error,
  warning,
  mono,
  name,
  placeholder
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary mb-1">
      {label}
    </label>
    <input
      type="text"
      id={id}
      name={name}
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      onKeyDown={onKeyDown}
      required={required}
      className={`w-full bg-v-light-bg dark:bg-v-dark border ${error ? 'border-v-danger' : 'border-v-light-border dark:border-v-border'} text-v-light-text-primary dark:text-v-text-primary px-3 py-2 focus:ring-2 focus:ring-v-accent focus:outline-none focus:border-v-accent transition duration-150 ease-in-out ${mono ? 'font-mono' : 'font-sans'} rounded-md`}
    />
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
