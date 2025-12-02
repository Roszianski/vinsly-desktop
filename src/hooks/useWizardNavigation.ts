/**
 * Shared hook for wizard-style multi-step form navigation
 * Used by AgentEditorScreen and SkillEditorScreen
 */

import { useState, useCallback, useMemo } from 'react';

export interface WizardStep<TStepId extends string = string> {
  id: TStepId;
  label: string;
  description: string;
  required?: boolean;
}

export interface UseWizardNavigationOptions<TStepId extends string = string> {
  /** Array of wizard steps */
  steps: WizardStep<TStepId>[];
  /** Initial step index (default: 0) */
  initialStepIndex?: number;
  /** Callback to determine if a step is complete */
  isStepComplete?: (stepId: TStepId) => boolean;
  /** Callback to determine if user can proceed from a step */
  canProceedFromStep?: (stepId: TStepId) => boolean;
}

export interface WizardNavigationState<TStepId extends string = string> {
  /** Current step index */
  currentStepIndex: number;
  /** Set of visited step indices */
  visitedSteps: Set<number>;
  /** Animation direction (1 for forward, -1 for backward) */
  direction: number;
  /** Current step object */
  currentStep: WizardStep<TStepId>;
  /** Whether current step is the last step */
  isLastStep: boolean;
  /** Whether current step is the first step */
  isFirstStep: boolean;
  /** Go to a specific step by index */
  goToStep: (index: number) => void;
  /** Go to next step */
  handleNextStep: () => void;
  /** Go to previous step */
  handlePreviousStep: () => void;
  /** Reset wizard to initial state */
  resetWizard: () => void;
  /** Sidebar step data with computed states */
  sidebarSteps: SidebarStep<TStepId>[];
  /** Completion percentage (0-100) */
  completionPercentage: number;
  /** Whether user can proceed to next step */
  canProceed: boolean;
}

export interface SidebarStep<TStepId extends string = string> extends WizardStep<TStepId> {
  index: number;
  isActive: boolean;
  isVisited: boolean;
  isComplete: boolean;
}

export function useWizardNavigation<TStepId extends string = string>(
  options: UseWizardNavigationOptions<TStepId>
): WizardNavigationState<TStepId> {
  const {
    steps,
    initialStepIndex = 0,
    isStepComplete = () => true,
    canProceedFromStep = () => true,
  } = options;

  const [currentStepIndex, setCurrentStepIndex] = useState(initialStepIndex);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([initialStepIndex]));
  const [direction, setDirection] = useState(1);

  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;
  const isFirstStep = currentStepIndex === 0;

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= steps.length) return;
      setDirection(nextIndex > currentStepIndex ? 1 : -1);
      setCurrentStepIndex(nextIndex);
      setVisitedSteps((prev) => {
        const next = new Set(prev);
        next.add(nextIndex);
        return next;
      });
    },
    [currentStepIndex, steps.length]
  );

  const handleNextStep = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      goToStep(currentStepIndex + 1);
    }
  }, [currentStepIndex, goToStep, steps.length]);

  const handlePreviousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  const resetWizard = useCallback(() => {
    setCurrentStepIndex(initialStepIndex);
    setVisitedSteps(new Set([initialStepIndex]));
    setDirection(1);
  }, [initialStepIndex]);

  const sidebarSteps = useMemo((): SidebarStep<TStepId>[] => {
    return steps.map((step, index) => ({
      ...step,
      index,
      isActive: index === currentStepIndex,
      isVisited: visitedSteps.has(index),
      isComplete: isStepComplete(step.id),
    }));
  }, [steps, currentStepIndex, visitedSteps, isStepComplete]);

  const completionPercentage = useMemo(() => {
    const completedSteps = steps.filter((step) => isStepComplete(step.id)).length;
    return Math.round((completedSteps / steps.length) * 100);
  }, [steps, isStepComplete]);

  const canProceed = useMemo(() => {
    return canProceedFromStep(currentStep.id);
  }, [canProceedFromStep, currentStep.id]);

  return {
    currentStepIndex,
    visitedSteps,
    direction,
    currentStep,
    isLastStep,
    isFirstStep,
    goToStep,
    handleNextStep,
    handlePreviousStep,
    resetWizard,
    sidebarSteps,
    completionPercentage,
    canProceed,
  };
}

export default useWizardNavigation;
