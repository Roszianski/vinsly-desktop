/**
 * Shared hook for name/identifier validation
 * Used by AgentEditorScreen, SkillEditorScreen, and SlashCommandEditorScreen
 */

import { useState, useCallback, useMemo, useEffect } from 'react';

export interface NameValidationOptions {
  /** Current name value */
  value: string;
  /** List of existing names to check for duplicates */
  existingNames: string[];
  /** Original name (when editing, to allow keeping the same name) */
  originalName?: string;
  /** Custom validation pattern (default: lowercase letters and hyphens) */
  pattern?: RegExp;
  /** Custom pattern error message */
  patternErrorMessage?: string;
  /** Minimum length (default: 1) */
  minLength?: number;
  /** Maximum length (optional) */
  maxLength?: number;
  /** Whether to auto-lowercase input */
  autoLowercase?: boolean;
  /** Additional allowed characters in pattern message */
  allowedCharsDescription?: string;
}

export interface NameValidationResult {
  /** Whether the current name is valid */
  isValid: boolean;
  /** Error message (empty if valid) */
  error: string;
  /** Validate and return error message */
  validate: (nameValue: string) => string;
  /** Clear the current error */
  clearError: () => void;
  /** Set a custom error message */
  setError: (error: string) => void;
  /** Process input value (applies lowercase if enabled) */
  processInput: (value: string) => string;
}

const DEFAULT_PATTERN = /^[a-z-]+$/;
const DEFAULT_PATTERN_MESSAGE = 'Use lowercase letters and hyphens only (e.g., my-item)';

export function useNameValidation(options: NameValidationOptions): NameValidationResult {
  const {
    value,
    existingNames,
    originalName,
    pattern = DEFAULT_PATTERN,
    patternErrorMessage = DEFAULT_PATTERN_MESSAGE,
    minLength = 1,
    maxLength,
    autoLowercase = true,
    allowedCharsDescription,
  } = options;

  const [error, setError] = useState('');

  const validate = useCallback(
    (nameValue: string): string => {
      const trimmed = nameValue.trim();

      // Check required
      if (trimmed.length < minLength) {
        return minLength === 1 ? 'Name is required.' : `Name must be at least ${minLength} characters.`;
      }

      // Check max length
      if (maxLength && trimmed.length > maxLength) {
        return `Name must be at most ${maxLength} characters.`;
      }

      // Check pattern
      if (!pattern.test(trimmed)) {
        return allowedCharsDescription || patternErrorMessage;
      }

      // Check for duplicates (case-insensitive)
      const duplicates = existingNames
        .filter((name) => name !== originalName)
        .map((name) => name.toLowerCase());

      if (duplicates.includes(trimmed.toLowerCase())) {
        return 'This name is already taken. Choose a unique identifier.';
      }

      return '';
    },
    [existingNames, originalName, pattern, patternErrorMessage, minLength, maxLength, allowedCharsDescription]
  );

  const isValid = useMemo(() => {
    return validate(value) === '';
  }, [validate, value]);

  // Auto-validate when value changes
  useEffect(() => {
    const errorMessage = validate(value);
    setError(errorMessage);
  }, [value, validate]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const processInput = useCallback(
    (inputValue: string): string => {
      if (autoLowercase) {
        return inputValue.toLowerCase();
      }
      return inputValue;
    },
    [autoLowercase]
  );

  return {
    isValid,
    error,
    validate,
    clearError,
    setError,
    processInput,
  };
}

/**
 * Preset for agent name validation
 */
export function useAgentNameValidation(
  value: string,
  existingNames: string[],
  originalName?: string
): NameValidationResult {
  return useNameValidation({
    value,
    existingNames,
    originalName,
    pattern: /^[a-z-]+$/,
    patternErrorMessage: 'Use lowercase letters and hyphens only (e.g., code-reviewer).',
    autoLowercase: true,
  });
}

/**
 * Preset for skill name validation
 */
export function useSkillNameValidation(
  value: string,
  existingNames: string[],
  originalName?: string
): NameValidationResult {
  return useNameValidation({
    value,
    existingNames,
    originalName,
    pattern: /^[a-z0-9-]+$/,
    patternErrorMessage: 'Use lowercase letters, numbers, and hyphens only.',
    autoLowercase: true,
  });
}

/**
 * Preset for slash command name validation
 */
export function useCommandNameValidation(
  value: string,
  existingNames: string[],
  originalName?: string
): NameValidationResult {
  return useNameValidation({
    value,
    existingNames,
    originalName,
    pattern: /^[a-z0-9-]+$/,
    patternErrorMessage: 'Use lowercase letters, numbers, and hyphens only.',
    autoLowercase: true,
  });
}

export default useNameValidation;
