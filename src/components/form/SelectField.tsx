import React from 'react';

interface SelectFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
  hint?: string;
  name?: string;
}

export const SelectField: React.FC<SelectFieldProps> = ({
  label,
  id,
  value,
  onChange,
  children,
  hint,
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
      className="w-full bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary px-3 py-2 focus:ring-2 focus:ring-v-accent focus:outline-none focus:border-v-accent transition duration-150 ease-in-out rounded-md"
    >
      {children}
    </select>
    {hint && <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">{hint}</p>}
  </div>
);
