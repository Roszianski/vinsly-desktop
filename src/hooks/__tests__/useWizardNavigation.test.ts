import { renderHook, act } from '@testing-library/react';
import { useWizardNavigation, WizardStep } from '../useWizardNavigation';

const createTestSteps = (): WizardStep[] => [
  { id: 'step1', label: 'Step 1', description: 'First step', required: true },
  { id: 'step2', label: 'Step 2', description: 'Second step', required: true },
  { id: 'step3', label: 'Step 3', description: 'Third step', required: false },
  { id: 'step4', label: 'Step 4', description: 'Review', required: false },
];

describe('useWizardNavigation', () => {
  describe('initial state', () => {
    it('should start at step 0 by default', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({ steps: createTestSteps() })
      );

      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.currentStep.id).toBe('step1');
      expect(result.current.isFirstStep).toBe(true);
      expect(result.current.isLastStep).toBe(false);
    });

    it('should start at specified initial step', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({
          steps: createTestSteps(),
          initialStepIndex: 2,
        })
      );

      expect(result.current.currentStepIndex).toBe(2);
      expect(result.current.currentStep.id).toBe('step3');
    });

    it('should have first step in visited set', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({ steps: createTestSteps() })
      );

      expect(result.current.visitedSteps.has(0)).toBe(true);
      expect(result.current.visitedSteps.size).toBe(1);
    });
  });

  describe('navigation', () => {
    it('should navigate to next step', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({ steps: createTestSteps() })
      );

      act(() => {
        result.current.handleNextStep();
      });

      expect(result.current.currentStepIndex).toBe(1);
      expect(result.current.currentStep.id).toBe('step2');
      expect(result.current.direction).toBe(1);
    });

    it('should navigate to previous step', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({
          steps: createTestSteps(),
          initialStepIndex: 2,
        })
      );

      act(() => {
        result.current.handlePreviousStep();
      });

      expect(result.current.currentStepIndex).toBe(1);
      expect(result.current.direction).toBe(-1);
    });

    it('should not go beyond last step', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({
          steps: createTestSteps(),
          initialStepIndex: 3,
        })
      );

      act(() => {
        result.current.handleNextStep();
      });

      expect(result.current.currentStepIndex).toBe(3);
      expect(result.current.isLastStep).toBe(true);
    });

    it('should not go before first step', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({ steps: createTestSteps() })
      );

      act(() => {
        result.current.handlePreviousStep();
      });

      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.isFirstStep).toBe(true);
    });

    it('should navigate directly to a step', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({ steps: createTestSteps() })
      );

      act(() => {
        result.current.goToStep(3);
      });

      expect(result.current.currentStepIndex).toBe(3);
      expect(result.current.currentStep.id).toBe('step4');
    });

    it('should track visited steps', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({ steps: createTestSteps() })
      );

      // Navigate step by step to ensure state updates properly
      act(() => {
        result.current.handleNextStep();
      });
      act(() => {
        result.current.handleNextStep();
      });
      act(() => {
        result.current.handlePreviousStep();
      });

      expect(result.current.visitedSteps.has(0)).toBe(true);
      expect(result.current.visitedSteps.has(1)).toBe(true);
      expect(result.current.visitedSteps.has(2)).toBe(true);
      expect(result.current.currentStepIndex).toBe(1);
    });
  });

  describe('sidebar steps', () => {
    it('should generate sidebar steps with correct states', () => {
      const isStepComplete = (id: string) => id === 'step1';

      const { result } = renderHook(() =>
        useWizardNavigation({
          steps: createTestSteps(),
          isStepComplete,
        })
      );

      expect(result.current.sidebarSteps).toHaveLength(4);
      expect(result.current.sidebarSteps[0].isActive).toBe(true);
      expect(result.current.sidebarSteps[0].isComplete).toBe(true);
      expect(result.current.sidebarSteps[1].isComplete).toBe(false);
    });
  });

  describe('completion percentage', () => {
    it('should calculate completion percentage', () => {
      const isStepComplete = (id: string) => id === 'step1' || id === 'step2';

      const { result } = renderHook(() =>
        useWizardNavigation({
          steps: createTestSteps(),
          isStepComplete,
        })
      );

      expect(result.current.completionPercentage).toBe(50);
    });

    it('should be 100% when all steps complete', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({
          steps: createTestSteps(),
          isStepComplete: () => true,
        })
      );

      expect(result.current.completionPercentage).toBe(100);
    });
  });

  describe('reset', () => {
    it('should reset wizard to initial state', () => {
      const { result } = renderHook(() =>
        useWizardNavigation({ steps: createTestSteps() })
      );

      act(() => {
        result.current.handleNextStep();
        result.current.handleNextStep();
        result.current.resetWizard();
      });

      expect(result.current.currentStepIndex).toBe(0);
      expect(result.current.visitedSteps.size).toBe(1);
      expect(result.current.direction).toBe(1);
    });
  });

  describe('canProceed', () => {
    it('should check if user can proceed from current step', () => {
      const canProceedFromStep = (id: string) => id !== 'step2';

      const { result } = renderHook(() =>
        useWizardNavigation({
          steps: createTestSteps(),
          canProceedFromStep,
        })
      );

      expect(result.current.canProceed).toBe(true);

      act(() => {
        result.current.handleNextStep();
      });

      expect(result.current.canProceed).toBe(false);
    });
  });
});
