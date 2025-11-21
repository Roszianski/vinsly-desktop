import React from 'react';

interface WizardStep {
  id: string;
  label: string;
  description: string;
}

interface WizardStepHeaderProps {
  currentStepIndex: number;
  wizardSteps: WizardStep[];
}

export const WizardStepHeader: React.FC<WizardStepHeaderProps> = ({ currentStepIndex, wizardSteps }) => {
  const step = wizardSteps[currentStepIndex];
  const totalSteps = wizardSteps.length;
  const nextStep = wizardSteps[currentStepIndex + 1];
  const progressPercentage = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-v-light-text-secondary dark:text-v-text-secondary">
            Step {currentStepIndex + 1} of {totalSteps}
          </p>
          <h2 className="text-2xl font-semibold text-v-light-text-primary dark:text-v-text-primary mt-1">{step.label}</h2>
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1 max-w-2xl">{step.description}</p>
        </div>
        {nextStep && (
          <div className="text-right">
            <p className="text-xs uppercase text-v-light-text-secondary dark:text-v-text-secondary">Coming up</p>
            <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">{nextStep.label}</p>
          </div>
        )}
      </div>
      <div className="h-2 rounded-full bg-v-light-border dark:bg-v-border overflow-hidden">
        <div
          className="h-full bg-v-accent transition-all duration-300"
          style={{ width: `${progressPercentage}%` }}
          aria-hidden="true"
        />
      </div>
    </div>
  );
};
