import { renderHook } from '@testing-library/react';
import {
  useNameValidation,
  useAgentNameValidation,
  useSkillNameValidation,
  useCommandNameValidation,
} from '../useNameValidation';

describe('useNameValidation', () => {
  describe('basic validation', () => {
    it('should be valid with correct name', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'my-agent',
          existingNames: [],
        })
      );

      expect(result.current.isValid).toBe(true);
      expect(result.current.error).toBe('');
    });

    it('should be invalid when empty', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: '',
          existingNames: [],
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Name is required.');
    });

    it('should reject invalid characters', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'My Agent!',
          existingNames: [],
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toContain('lowercase');
    });

    it('should detect duplicates', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'existing-name',
          existingNames: ['existing-name', 'other-name'],
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toContain('already taken');
    });

    it('should allow original name when editing', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'my-agent',
          existingNames: ['my-agent', 'other-agent'],
          originalName: 'my-agent',
        })
      );

      expect(result.current.isValid).toBe(true);
    });
  });

  describe('custom pattern', () => {
    it('should use custom validation pattern', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'my_agent123',
          existingNames: [],
          pattern: /^[a-z0-9_]+$/,
          patternErrorMessage: 'Use lowercase, numbers, and underscores only.',
        })
      );

      expect(result.current.isValid).toBe(true);
    });

    it('should show custom error message for pattern mismatch', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'My-Agent',
          existingNames: [],
          pattern: /^[a-z_]+$/,
          patternErrorMessage: 'Custom error message',
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toBe('Custom error message');
    });
  });

  describe('length constraints', () => {
    it('should enforce minimum length', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'ab',
          existingNames: [],
          minLength: 3,
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toContain('at least 3');
    });

    it('should enforce maximum length', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'this-is-a-very-long-name',
          existingNames: [],
          maxLength: 10,
        })
      );

      expect(result.current.isValid).toBe(false);
      expect(result.current.error).toContain('at most 10');
    });
  });

  describe('processInput', () => {
    it('should lowercase input when autoLowercase is true', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'test',
          existingNames: [],
          autoLowercase: true,
        })
      );

      expect(result.current.processInput('MyAgent')).toBe('myagent');
    });

    it('should not modify input when autoLowercase is false', () => {
      const { result } = renderHook(() =>
        useNameValidation({
          value: 'test',
          existingNames: [],
          autoLowercase: false,
        })
      );

      expect(result.current.processInput('MyAgent')).toBe('MyAgent');
    });
  });
});

describe('preset validation hooks', () => {
  describe('useAgentNameValidation', () => {
    it('should accept valid agent names', () => {
      const { result } = renderHook(() =>
        useAgentNameValidation('code-reviewer', [])
      );

      expect(result.current.isValid).toBe(true);
    });

    it('should reject numbers in agent names', () => {
      const { result } = renderHook(() =>
        useAgentNameValidation('agent123', [])
      );

      expect(result.current.isValid).toBe(false);
    });
  });

  describe('useSkillNameValidation', () => {
    it('should accept valid skill names with numbers', () => {
      const { result } = renderHook(() =>
        useSkillNameValidation('skill-v2', [])
      );

      expect(result.current.isValid).toBe(true);
    });
  });

  describe('useCommandNameValidation', () => {
    it('should accept valid command names', () => {
      const { result } = renderHook(() =>
        useCommandNameValidation('review-pr', [])
      );

      expect(result.current.isValid).toBe(true);
    });

    it('should reject uppercase in command names', () => {
      const { result } = renderHook(() =>
        useCommandNameValidation('ReviewPR', [])
      );

      expect(result.current.isValid).toBe(false);
    });
  });
});
