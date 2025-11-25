import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TourTooltip, TooltipPosition } from './TourTooltip';

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  position?: TooltipPosition;
}

export type TourType = 'main' | 'skills' | 'team' | 'analytics' | 'editor';
export type EditorTourMode = 'wizard' | 'form';

interface GuidedTourProps {
  isActive: boolean;
  onComplete: () => void;
  tourType: TourType;
  editorMode?: EditorTourMode | null;
}

const TOUR_EVENT_NAME = 'vinsly-tour-step';

export const GuidedTour: React.FC<GuidedTourProps> = ({ isActive, onComplete, tourType, editorMode }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const mainTourSteps: TourStep[] = [
    {
      targetSelector: '[data-tour="scan-button"]',
      title: 'Scan for Agents',
      description: 'Keep Vinsly in sync with agents on disk. Deep Scan searches your whole home directory, while Project-Specific Scan is scoped to a chosen project or folder.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="agent-list"]',
      title: 'Review & Filter',
      description: 'These summary cards, filters, and bulk actions give you control over every agent. Search, scope filters, and sort options all live here.',
      position: 'left'
    },
    {
      targetSelector: '[data-tour="create-agent"]',
      title: 'Create New Agents',
      description: 'Spin up a fresh agent with one click or use ⌘N / Ctrl+N. This is the fastest path into the builder.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="team-view"]',
      title: 'Swarm View Relationships',
      description: 'Open Swarm View to see mind-map style connections and collaboration paths between agents.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="analytics-view"]',
      title: 'Dive Into Analytics',
      description: 'Open the Analytics dashboard for deeper insights: model usage, tool coverage, and complexity trends across your fleet.',
      position: 'bottom'
    }
  ];

  const skillsTourSteps: TourStep[] = [
    {
      targetSelector: '[data-tour="skill-view-switcher"]',
      title: 'Switch Contexts',
      description: 'Jump between subagents, skills, Swarm View, and analytics without losing your place.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="skill-toolbar"]',
      title: 'Search & Filter',
      description: 'Use search, scope filters, import/export, and bulk actions to manage skills quickly.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="skill-layout"]',
      title: 'Pick Your Layout',
      description: 'Toggle between table and grid while keeping the column headers visible for reference.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="create-skill"]',
      title: 'Create New Skills',
      description: 'Start a new skill from scratch—perfect for reusable workflows Claude can call on demand.',
      position: 'left'
    }
  ];

  const teamTourSteps: TourStep[] = [
    {
      targetSelector: '[data-tour="team-graph"]',
      title: 'Swarm View Overview',
      description: 'Start here for the high-level summary. It gives you context on what this view is optimising for and how to interpret it.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="team-filters"]',
      title: 'Filter & Focus',
      description: 'Use these chips to toggle scopes, highlight favourites, and reset quickly. Mix and match filters without losing sight of the rest of the map.',
      position: 'right'
    },
    {
      targetSelector: '[data-tour="team-node-area"]',
      title: 'Explore the Graph',
      description: 'Pan, zoom, and hover nodes to open detailed cards. Favourites float to the top when highlighted so you can track critical agents instantly.',
      position: 'top'
    }
  ];

  const analyticsTourSteps: TourStep[] = [
    {
      targetSelector: '[data-tour="analytics-summary"]',
      title: 'Key Metrics',
      description: 'These tiles summarise total agents, complexity, models, and tool coverage so you can spot trends at a glance.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="analytics-charts"]',
      title: 'Usage Breakdown',
      description: 'Compare model adoption versus tool usage to understand how your fleet is balanced across capabilities.',
      position: 'right'
    },
    {
      targetSelector: '[data-tour="analytics-complexity"]',
      title: 'Complexity Deep Dive',
      description: 'Review per-agent complexity scores alongside the chart to see which automations may need refactoring.',
      position: 'right'
    },
    {
      targetSelector: '[data-tour="analytics-recommendations"]',
      title: 'Actionable Insights',
      description: 'Vinsly suggests next steps—optimise prompts, rebalance teams, or add missing tools based on the data above.',
      position: 'right'
    }
  ];

  const editorWizardSteps: TourStep[] = [
    {
      targetSelector: '[data-tour="wizard-steps"]',
      title: 'Plan Your Build',
      description: 'Use this overview to see every step, track progress, and jump directly to the section you need for this agent or skill.',
      position: 'right'
    },
    {
      targetSelector: '[data-tour="wizard-config-panel"]',
      title: 'Configure the Details',
      description: 'This panel is where you fill out each step—scope, metadata, instructions, and workflow notes live here.',
      position: 'left'
    }
  ];

  const editorFormSteps: TourStep[] = [
    {
      targetSelector: '[data-tour="agent-details"]',
      title: 'Agent Details',
      description: 'Set the basics like scope, identifiers, descriptions, and model metadata in this configuration panel.',
      position: 'bottom'
    },
    {
      targetSelector: '[data-tour="agent-tools"]',
      title: 'Tool Permissions',
      description: 'Choose exactly which tools this agent can call and review the associated risk levels.',
      position: 'top'
    },
    {
      targetSelector: '[data-tour="agent-prompt"]',
      title: 'Instructions & Prompt',
      description: 'Craft the system prompt so Claude knows when and how to use the agent.',
      position: 'left'
    }
  ];

  const getEditorSteps = () => {
    if (editorMode === 'form') return editorFormSteps;
    return editorWizardSteps;
  };

  const steps =
    tourType === 'main'
      ? mainTourSteps
      : tourType === 'skills'
        ? skillsTourSteps
        : tourType === 'team'
        ? teamTourSteps
        : tourType === 'analytics'
          ? analyticsTourSteps
          : getEditorSteps();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detail = {
      tourType,
      stepIndex: isActive ? currentStepIndex : null,
      editorMode: editorMode || null,
    };
    window.dispatchEvent(new CustomEvent(TOUR_EVENT_NAME, { detail }));
  }, [currentStepIndex, editorMode, isActive, tourType]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    setCurrentStepIndex(0);
    onComplete();
  };

  if (!isActive || steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];

  return (
    <>
      {/* Backdrop overlay */}
      <AnimatePresence>
        {isActive && (
          <div
            className="fixed inset-0 bg-black/15 dark:bg-black/35 z-[10000]"
            onClick={handleSkip}
          />
        )}
      </AnimatePresence>

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        {isActive && currentStep && (
          <TourTooltip
            key={`tour-step-${currentStepIndex}`}
            targetSelector={currentStep.targetSelector}
            title={currentStep.title}
            description={currentStep.description}
            currentStep={currentStepIndex + 1}
            totalSteps={steps.length}
            position={currentStep.position}
            onNext={handleNext}
            onSkip={handleSkip}
          />
        )}
      </AnimatePresence>
    </>
  );
};
