import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Hook,
  HookEventType,
  HookExecutionType,
  HookScope,
  HOOK_TEMPLATES,
  HookTemplate,
  validateHook,
  createHookId,
  getHookEventDisplayName,
  getHookEventDescription,
  getHookExecutionTypeDisplayName,
  getHookExecutionTypeDescription,
  getHookEnvVariables,
  getHookStdinFields,
  eventSupportsMatchers,
  eventSupportsPromptHooks,
  PROMPT_HOOK_VARIABLES,
  STDIN_FIELD_DESCRIPTIONS,
} from '../../types/hooks';
import { wizardStepVariants } from '../../animations';
import { InputField, TextareaField } from '../form';
import { WizardStepHeader } from '../wizard';
import { CheckIcon } from '../icons/CheckIcon';
import { WarningIcon } from '../icons/WarningIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { LightningIcon } from '../icons/LightningIcon';

interface HooksEditorScreenProps {
  hook: Hook | null;
  onSave: (hook: Hook, projectPath?: string) => void;
  onCancel: () => void;
  mode: 'create' | 'edit';
  existingNames: string[];
  projectPath?: string;
}

type WizardStepId =
  | 'template'
  | 'event'
  | 'execution'
  | 'config'
  | 'scope'
  | 'review';

const WIZARD_STEPS: { id: WizardStepId; label: string; description: string; required: boolean }[] = [
  {
    id: 'template',
    label: 'Start from template',
    description: 'Choose a pre-configured template or start from scratch.',
    required: false
  },
  {
    id: 'event',
    label: 'Event type',
    description: 'Select when this hook should run.',
    required: true
  },
  {
    id: 'execution',
    label: 'Execution type',
    description: 'Choose how the hook executes: bash command or LLM prompt.',
    required: true
  },
  {
    id: 'config',
    label: 'Hook configuration',
    description: 'Configure the hook name, command/prompt, and optional matcher.',
    required: true
  },
  {
    id: 'scope',
    label: 'Save location',
    description: 'Choose where to save this hook configuration.',
    required: true
  },
  {
    id: 'review',
    label: 'Review & Save',
    description: 'Confirm details before saving.',
    required: false
  },
];

const EVENT_TYPE_OPTIONS: { value: HookEventType; title: string; description: string; supportsMatcher: boolean; supportsPrompt: boolean }[] = [
  {
    value: 'PreToolUse',
    title: 'Before Tool Use',
    description: 'Runs before Claude uses a tool. Can block execution or modify input.',
    supportsMatcher: true,
    supportsPrompt: true
  },
  {
    value: 'PostToolUse',
    title: 'After Tool Use',
    description: 'Runs after Claude uses a tool. Receives tool output.',
    supportsMatcher: true,
    supportsPrompt: false
  },
  {
    value: 'PermissionRequest',
    title: 'Permission Request',
    description: 'Runs when a permission dialog is shown. Can auto-approve or deny.',
    supportsMatcher: true,
    supportsPrompt: true
  },
  {
    value: 'Notification',
    title: 'On Notification',
    description: 'Runs when Claude sends a notification message.',
    supportsMatcher: true,
    supportsPrompt: false
  },
  {
    value: 'UserPromptSubmit',
    title: 'User Prompt Submit',
    description: 'Runs when user submits a prompt. Can add context or block.',
    supportsMatcher: false,
    supportsPrompt: true
  },
  {
    value: 'Stop',
    title: 'Session Stop',
    description: 'Runs when the Claude Code session ends. Can prevent stopping.',
    supportsMatcher: false,
    supportsPrompt: true
  },
  {
    value: 'SubagentStop',
    title: 'Subagent Stop',
    description: 'Runs when a subagent completes execution.',
    supportsMatcher: false,
    supportsPrompt: true
  },
  {
    value: 'PreCompact',
    title: 'Before Compaction',
    description: 'Runs before context is compacted. Preserve important information.',
    supportsMatcher: false,
    supportsPrompt: false
  },
  {
    value: 'SessionStart',
    title: 'Session Start',
    description: 'Runs when a session starts. Set up environment and context.',
    supportsMatcher: false,
    supportsPrompt: false
  },
  {
    value: 'SessionEnd',
    title: 'Session End',
    description: 'Runs when a session terminates.',
    supportsMatcher: false,
    supportsPrompt: false
  }
];

const EXECUTION_TYPE_OPTIONS: { value: HookExecutionType; title: string; description: string }[] = [
  {
    value: 'command',
    title: 'Command (Bash)',
    description: 'Execute a shell command. Exit code 0 = success, exit code 2 = block.'
  },
  {
    value: 'prompt',
    title: 'Prompt (LLM)',
    description: 'Evaluate using an LLM. Returns JSON with decision (approve/block).'
  }
];

const SCOPE_DETAILS: Record<HookScope, { title: string; description: string; path: string }> = {
  user: {
    title: 'User (Global)',
    description: 'Saved to ~/.claude/settings.json. Available in all your projects.',
    path: '~/.claude/settings.json'
  },
  project: {
    title: 'Project',
    description: 'Saved to .claude/settings.json in the project. Shared via git with your team.',
    path: '.claude/settings.json'
  },
  local: {
    title: 'Local (Private)',
    description: 'Saved to .claude/settings.local.json. Not tracked by git.',
    path: '.claude/settings.local.json'
  }
};

const createEmptyHook = (): Hook => ({
  id: '',
  name: '',
  eventType: 'PreToolUse',
  executionType: 'command',
  command: '',
  prompt: '',
  scope: 'user',
  sourcePath: '',
  enabled: true,
});

export const HooksEditorScreen: React.FC<HooksEditorScreenProps> = ({
  hook,
  onSave,
  onCancel,
  mode,
  existingNames,
  projectPath,
}) => {
  const [formData, setFormData] = useState<Hook>(hook || createEmptyHook());
  const [nameError, setNameError] = useState('');
  const [commandError, setCommandError] = useState('');
  const [promptError, setPromptError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<HookTemplate | null>(null);
  const [projectFolderPath, setProjectFolderPath] = useState(projectPath || '');
  const [projectFolderError, setProjectFolderError] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [hasReachedReview, setHasReachedReview] = useState(false);
  const [direction, setDirection] = useState(1);

  const isWizard = mode === 'create';

  useEffect(() => {
    if (hook) {
      setFormData(hook);
    }
  }, [hook]);

  useEffect(() => {
    if (mode === 'create') {
      setCurrentStepIndex(0);
      setVisitedSteps(new Set([0]));
      setHasReachedReview(false);
    }
  }, [mode]);

  const validateName = useCallback(
    (nameValue: string) => {
      if (!nameValue) {
        setNameError('Hook name is required.');
        return false;
      }
      if (!/^[a-z0-9-_]+$/i.test(nameValue)) {
        setNameError('Use letters, numbers, hyphens, and underscores only.');
        return false;
      }
      if (mode === 'create' && existingNames.includes(nameValue)) {
        setNameError('This name is already taken.');
        return false;
      }
      setNameError('');
      return true;
    },
    [existingNames, mode]
  );

  const validateCommand = useCallback((cmd: string) => {
    if (!cmd.trim()) {
      setCommandError('Command is required.');
      return false;
    }
    setCommandError('');
    return true;
  }, []);

  const validatePrompt = useCallback((prompt: string) => {
    if (!prompt.trim()) {
      setPromptError('Prompt is required.');
      return false;
    }
    setPromptError('');
    return true;
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, name: value }));
    if (value) validateName(value);
  };

  const handleEventTypeChange = (eventType: HookEventType) => {
    setFormData(prev => ({ ...prev, eventType }));
  };

  const handleExecutionTypeChange = (executionType: HookExecutionType) => {
    setFormData(prev => ({ ...prev, executionType }));
    // Clear errors when switching type
    if (executionType === 'command') {
      setPromptError('');
    } else {
      setCommandError('');
    }
  };

  const handleScopeChange = (scope: HookScope) => {
    setFormData(prev => ({ ...prev, scope }));
    if (scope !== 'project' && scope !== 'local') {
      setProjectFolderError('');
    }
  };

  const handleTemplateSelect = (template: HookTemplate | null) => {
    setSelectedTemplate(template);
    if (template) {
      setFormData(prev => ({
        ...prev,
        name: template.name,
        eventType: template.eventType,
        executionType: template.executionType,
        command: template.config.command,
        prompt: template.config.prompt,
        matcher: template.config.matcher,
        timeout: template.config.timeout,
      }));
    }
  };

  const handlePickProjectFolder = async () => {
    setIsPickingProjectFolder(true);
    try {
      const selected = await open({ directory: true, multiple: false });
      if (selected && typeof selected === 'string') {
        setProjectFolderPath(selected);
        setProjectFolderError('');
      }
    } finally {
      setIsPickingProjectFolder(false);
    }
  };

  // Step completion check - moved before goToStep since it's used by canNavigateToStep
  const isStepComplete = useCallback((stepId: WizardStepId): boolean => {
    switch (stepId) {
      case 'template':
        return true; // Optional step
      case 'event':
        return Boolean(formData.eventType);
      case 'execution':
        return Boolean(formData.executionType);
      case 'config': {
        const hasName = Boolean(formData.name);
        const hasCommandOrPrompt = formData.executionType === 'command'
          ? Boolean(formData.command)
          : Boolean(formData.prompt);
        return hasName && hasCommandOrPrompt;
      }
      case 'scope':
        if ((formData.scope === 'project' || formData.scope === 'local') && !projectFolderPath) return false;
        return true;
      case 'review': {
        const hasEventType = Boolean(formData.eventType);
        const hasExecutionType = Boolean(formData.executionType);
        const hasName = Boolean(formData.name);
        const hasCommandOrPrompt = formData.executionType === 'command'
          ? Boolean(formData.command)
          : Boolean(formData.prompt);
        const hasValidScope = !((formData.scope === 'project' || formData.scope === 'local') && !projectFolderPath);
        return hasEventType && hasExecutionType && hasName && hasCommandOrPrompt && hasValidScope;
      }
      default:
        return false;
    }
  }, [formData.eventType, formData.executionType, formData.name, formData.command, formData.prompt, formData.scope, projectFolderPath]);

  // Check if navigation to a specific step is allowed
  // Strictly sequential: can only unlock the next step after completing the current one
  const canNavigateToStep = useCallback((targetIndex: number): boolean => {
    // Once review has been reached, allow free navigation to any step
    if (hasReachedReview) {
      return true;
    }

    // Always allow navigating to already visited steps (going back)
    if (visitedSteps.has(targetIndex)) {
      return true;
    }

    // For unvisited steps, can only go to the immediate next step after current
    // First, find the highest completed step index that's been visited
    let highestCompletedVisitedIndex = -1;
    for (let i = 0; i < WIZARD_STEPS.length; i++) {
      if (!visitedSteps.has(i)) continue;
      const step = WIZARD_STEPS[i];
      // Check if this visited step is complete (required steps must be complete, optional are always ok)
      if (!step.required || isStepComplete(step.id)) {
        highestCompletedVisitedIndex = i;
      } else {
        // Found an incomplete required step - can't go past this
        break;
      }
    }

    // Can only navigate to the very next step after the highest completed visited step
    return targetIndex === highestCompletedVisitedIndex + 1;
  }, [isStepComplete, hasReachedReview, visitedSteps]);

  const goToStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= WIZARD_STEPS.length) return;
    // Allow going backwards freely, but check completion for forward navigation
    const isGoingBack = nextIndex < currentStepIndex;
    const isReviewStep = WIZARD_STEPS[nextIndex].id === 'review';
    if (!isGoingBack && !isReviewStep && !canNavigateToStep(nextIndex)) {
      return;
    }
    if (isReviewStep && !canNavigateToStep(nextIndex)) {
      return;
    }
    setDirection(nextIndex > currentStepIndex ? 1 : -1);
    setCurrentStepIndex(nextIndex);
    setVisitedSteps(prev => new Set(prev).add(nextIndex));
    // Mark that user has reached review, enabling free navigation
    if (isReviewStep) {
      setHasReachedReview(true);
    }
  }, [currentStepIndex, canNavigateToStep]);

  const handleNextStep = () => {
    const currentStep = WIZARD_STEPS[currentStepIndex];

    // Validation per step
    if (currentStep.id === 'config') {
      if (!validateName(formData.name)) return;
      if (formData.executionType === 'command') {
        if (!validateCommand(formData.command || '')) return;
      } else {
        if (!validatePrompt(formData.prompt || '')) return;
      }
    }

    if (currentStep.id === 'scope') {
      if ((formData.scope === 'project' || formData.scope === 'local') && !projectFolderPath) {
        setProjectFolderError('Please select a project folder.');
        return;
      }
    }

    goToStep(currentStepIndex + 1);
  };

  const handlePrevStep = () => {
    goToStep(currentStepIndex - 1);
  };

  const handleSave = () => {
    // Build final hook object
    const finalHook: Hook = {
      ...formData,
      id: createHookId(formData.name, formData.scope),
    };

    const errors = validateHook(finalHook);
    if (errors.length > 0) {
      return;
    }

    const needsProjectPath = formData.scope === 'project' || formData.scope === 'local';
    onSave(finalHook, needsProjectPath ? projectFolderPath : undefined);
  };

  const currentStep = WIZARD_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  // Calculate progress percentage based on completed steps, not current position
  const completedSteps = WIZARD_STEPS.filter(step => isStepComplete(step.id)).length;
  const progressPercentage = Math.round((completedSteps / WIZARD_STEPS.length) * 100);

  // Sidebar steps data
  const sidebarSteps = WIZARD_STEPS.map((step, index) => ({
    ...step,
    index,
    isActive: currentStepIndex === index,
    isVisited: visitedSteps.has(index),
    isComplete: isStepComplete(step.id),
    canNavigate: canNavigateToStep(index),
  }));

  // Get available environment variables and stdin fields for current event type
  const availableEnvVars = getHookEnvVariables(formData.eventType);
  const availableStdinFields = getHookStdinFields(formData.eventType);
  const supportsMatchers = eventSupportsMatchers(formData.eventType);
  const supportsPromptHooks = eventSupportsPromptHooks(formData.eventType);

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'template':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTemplateSelect(null)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedTemplate === null
                    ? 'border-v-accent bg-v-accent/10'
                    : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <LightningIcon className="h-5 w-5 text-v-accent" />
                  <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    Start from scratch
                  </span>
                </div>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                  Configure everything manually
                </p>
              </button>

              {HOOK_TEMPLATES.map(template => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedTemplate?.id === template.id
                      ? 'border-v-accent bg-v-accent/10'
                      : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <LightningIcon className="h-5 w-5 text-v-accent" />
                    <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                      {template.displayName}
                    </span>
                  </div>
                  <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        );

      case 'event':
        return (
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
            {EVENT_TYPE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleEventTypeChange(option.value)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  formData.eventType === option.value
                    ? 'border-v-accent bg-v-accent/10'
                    : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                      {option.title}
                    </span>
                    {option.supportsMatcher && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded">
                        Matcher
                      </span>
                    )}
                    {option.supportsPrompt && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-violet-500/20 text-violet-600 dark:text-violet-400 rounded">
                        LLM
                      </span>
                    )}
                  </div>
                  {formData.eventType === option.value && (
                    <CheckIcon className="h-5 w-5 text-v-accent" />
                  )}
                </div>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                  {option.description}
                </p>
              </button>
            ))}
          </div>
        );

      case 'execution':
        return (
          <div className="space-y-3">
            {EXECUTION_TYPE_OPTIONS.map(option => {
              const isPromptDisabled = option.value === 'prompt' && !supportsPromptHooks;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => !isPromptDisabled && handleExecutionTypeChange(option.value)}
                  disabled={isPromptDisabled}
                  className={`w-full p-4 rounded-lg border text-left transition-all ${
                    formData.executionType === option.value
                      ? 'border-v-accent bg-v-accent/10'
                      : isPromptDisabled
                        ? 'border-v-light-border dark:border-v-border opacity-50 cursor-not-allowed'
                        : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                        {option.title}
                      </span>
                      {isPromptDisabled && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded">
                          Not supported
                        </span>
                      )}
                    </div>
                    {formData.executionType === option.value && (
                      <CheckIcon className="h-5 w-5 text-v-accent" />
                    )}
                  </div>
                  <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                    {isPromptDisabled
                      ? `Prompt hooks are not available for ${getHookEventDisplayName(formData.eventType)}`
                      : option.description}
                  </p>
                </button>
              );
            })}

            <div className="mt-4 p-4 rounded-lg bg-v-light-hover dark:bg-v-light-dark border border-v-light-border dark:border-v-border">
              <h4 className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
                {formData.executionType === 'command' ? 'Command Hook' : 'Prompt Hook'}
              </h4>
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                {formData.executionType === 'command'
                  ? 'Executes a shell command. Return exit code 0 for success, exit code 2 to block the operation.'
                  : 'Uses an LLM (Haiku) to evaluate the context. Return JSON with decision (approve/block) and reason.'}
              </p>
            </div>
          </div>
        );

      case 'config':
        return (
          <div className="space-y-6">
            <InputField
              id="hook-name"
              label="Hook name"
              value={formData.name}
              onChange={handleNameChange}
              placeholder="e.g., bash-safety-check, tool-logger"
              error={nameError}
              hint="Unique identifier for this hook"
            />

            {formData.executionType === 'command' ? (
              <div>
                <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-1">
                  Command
                </label>
                <textarea
                  value={formData.command || ''}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, command: e.target.value }));
                    validateCommand(e.target.value);
                  }}
                  placeholder={`e.g., echo "Tool: $TOOL_NAME" >> ~/.claude/log.txt`}
                  rows={3}
                  className="w-full px-3 py-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-md text-sm font-mono text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-1 focus:ring-v-accent resize-none"
                />
                {commandError && (
                  <p className="mt-1 text-sm text-v-danger">{commandError}</p>
                )}
                <p className="mt-1 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                  Shell command to execute when the hook triggers
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-1">
                  Prompt
                </label>
                <textarea
                  value={formData.prompt || ''}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, prompt: e.target.value }));
                    validatePrompt(e.target.value);
                  }}
                  placeholder={`e.g., Evaluate if this operation should proceed. Context: $ARGUMENTS\n\nRespond with JSON: {"decision": "approve" or "block", "reason": "explanation"}`}
                  rows={5}
                  className="w-full px-3 py-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-md text-sm font-mono text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-1 focus:ring-v-accent resize-none"
                />
                {promptError && (
                  <p className="mt-1 text-sm text-v-danger">{promptError}</p>
                )}
                <p className="mt-1 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                  LLM prompt to evaluate. Use $ARGUMENTS to include context.
                </p>
              </div>
            )}

            {supportsMatchers && (
              <InputField
                id="hook-matcher"
                label="Matcher (optional)"
                value={formData.matcher || ''}
                onChange={e => setFormData(prev => ({ ...prev, matcher: e.target.value || undefined }))}
                placeholder="e.g., Bash|Write|Edit"
                hint="Regex pattern to filter which tools trigger this hook"
              />
            )}

            <InputField
              id="hook-timeout"
              label="Timeout (optional)"
              value={formData.timeout?.toString() || ''}
              onChange={e => {
                const value = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  timeout: value ? parseInt(value, 10) : undefined
                }));
              }}
              placeholder="60"
              hint="Timeout in seconds (default: 60)"
            />

            {formData.executionType === 'command' && (
              <div className="space-y-4">
                {/* Environment Variables */}
                <div className="p-4 rounded-lg bg-v-light-hover dark:bg-v-light-dark border border-v-light-border dark:border-v-border">
                  <h4 className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
                    Environment Variables
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {availableEnvVars.map(varName => (
                      <code
                        key={varName}
                        className="px-2 py-0.5 text-xs bg-v-light-surface dark:bg-v-mid-dark rounded border border-v-light-border dark:border-v-border font-mono text-v-accent"
                      >
                        ${varName}
                      </code>
                    ))}
                  </div>
                </div>

                {/* Stdin Input Fields */}
                <div className="p-4 rounded-lg bg-v-light-hover dark:bg-v-light-dark border border-v-light-border dark:border-v-border">
                  <h4 className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
                    JSON Input (via stdin)
                  </h4>
                  <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mb-2">
                    Full context is provided as JSON via stdin. Parse with: <code className="font-mono text-v-accent">jq</code> or your preferred JSON parser.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {availableStdinFields.map(field => (
                      <code
                        key={field}
                        className="px-2 py-0.5 text-xs bg-v-light-surface dark:bg-v-mid-dark rounded border border-v-light-border dark:border-v-border font-mono text-v-accent"
                        title={STDIN_FIELD_DESCRIPTIONS[field] || field}
                      >
                        {field}
                      </code>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {formData.executionType === 'prompt' && (
              <div className="p-4 rounded-lg bg-v-light-hover dark:bg-v-light-dark border border-v-light-border dark:border-v-border">
                <h4 className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
                  Prompt Variables
                </h4>
                <div className="flex flex-wrap gap-2">
                  {PROMPT_HOOK_VARIABLES.map(varName => (
                    <code
                      key={varName}
                      className="px-2 py-0.5 text-xs bg-v-light-surface dark:bg-v-mid-dark rounded border border-v-light-border dark:border-v-border font-mono text-v-accent"
                    >
                      {varName}
                    </code>
                  ))}
                </div>
                <p className="mt-2 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                  Use $ARGUMENTS to include the full hook input JSON in your prompt.
                </p>
              </div>
            )}
          </div>
        );

      case 'scope':
        return (
          <div className="space-y-4">
            {(['user', 'project', 'local'] as HookScope[]).map(scope => (
              <button
                key={scope}
                type="button"
                onClick={() => handleScopeChange(scope)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  formData.scope === scope
                    ? 'border-v-accent bg-v-accent/10'
                    : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {scope === 'user' ? (
                      <GlobeIcon className="h-5 w-5 text-v-accent" />
                    ) : (
                      <FolderIcon className="h-5 w-5 text-v-accent" />
                    )}
                    <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                      {SCOPE_DETAILS[scope].title}
                    </span>
                  </div>
                  {formData.scope === scope && (
                    <CheckIcon className="h-5 w-5 text-v-accent" />
                  )}
                </div>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-1">
                  {SCOPE_DETAILS[scope].description}
                </p>
                <p className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary">
                  {SCOPE_DETAILS[scope].path}
                </p>
              </button>
            ))}

            {(formData.scope === 'project' || formData.scope === 'local') && (
              <div className="mt-4 p-4 rounded-lg border border-v-light-border dark:border-v-border bg-v-light-surface dark:bg-v-mid-dark">
                <label className="block text-sm font-medium text-v-light-text-primary dark:text-v-text-primary mb-2">
                  Project folder
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={projectFolderPath}
                    readOnly
                    placeholder="Select a project folder..."
                    className="flex-1 px-3 py-2 bg-v-light-bg dark:bg-v-dark border border-v-light-border dark:border-v-border rounded-md text-sm text-v-light-text-primary dark:text-v-text-primary"
                  />
                  <button
                    type="button"
                    onClick={handlePickProjectFolder}
                    disabled={isPickingProjectFolder}
                    className="px-4 py-2 bg-v-accent text-white text-sm font-medium rounded-md hover:bg-v-accent-hover transition-colors disabled:opacity-50"
                  >
                    {isPickingProjectFolder ? 'Selecting...' : 'Browse'}
                  </button>
                </div>
                {projectFolderError && (
                  <p className="mt-2 text-sm text-v-danger flex items-center gap-1">
                    <WarningIcon className="h-4 w-4" />
                    {projectFolderError}
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'review':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-v-light-border dark:border-v-border bg-v-light-surface dark:bg-v-mid-dark">
              <h3 className="font-semibold text-v-light-text-primary dark:text-v-text-primary mb-4">
                Hook Configuration
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Name</dt>
                  <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    {formData.name}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Event</dt>
                  <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    {getHookEventDisplayName(formData.eventType)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Type</dt>
                  <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    {getHookExecutionTypeDisplayName(formData.executionType)}
                  </dd>
                </div>
                {formData.matcher && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Matcher</dt>
                    <dd className="text-sm font-mono text-v-light-text-primary dark:text-v-text-primary">
                      {formData.matcher}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-1">
                    {formData.executionType === 'command' ? 'Command' : 'Prompt'}
                  </dt>
                  <dd className="text-sm font-mono text-v-light-text-primary dark:text-v-text-primary bg-v-light-hover dark:bg-v-light-dark p-2 rounded whitespace-pre-wrap">
                    {formData.executionType === 'command' ? formData.command : formData.prompt}
                  </dd>
                </div>
                {formData.timeout && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Timeout</dt>
                    <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                      {formData.timeout}s
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Scope</dt>
                  <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    {SCOPE_DETAILS[formData.scope].title}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const title = mode === 'create' ? 'New Hook' : `Edit ${hook?.name}`;
  const saveLabel = mode === 'edit' ? 'Save Changes' : 'Create Hook';

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <LightningIcon className="w-5 h-5 text-v-accent" />
          <h1 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
            {title}
          </h1>
        </div>
      </div>

      {/* Sidebar Layout for Wizard */}
      {isWizard ? (
        <div className="grid gap-6 md:grid-cols-[260px,1fr]" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '1.5rem' }}>
          {/* Sidebar */}
          <aside className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">Steps</p>
              <p className="text-base font-semibold text-v-light-text-primary dark:text-v-text-primary">Hook setup</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-v-light-text-secondary dark:text-v-text-secondary">Step {currentStepIndex + 1} of {WIZARD_STEPS.length}</span>
                <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">{progressPercentage}%</span>
              </div>
              <div className="h-2 bg-v-light-border dark:bg-v-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-v-accent to-v-accent-hover rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              {sidebarSteps.map(step => {
                const isClickable = step.isActive || step.index < currentStepIndex || step.canNavigate;
                return (
                  <button
                    type="button"
                    key={step.id}
                    onClick={() => isClickable && goToStep(step.index)}
                    disabled={!isClickable}
                    className={`w-full text-left flex items-start gap-4 rounded-xl border px-4 py-3 transition-all duration-150 ${
                      step.isActive
                        ? 'border-v-accent/80'
                        : !isClickable
                        ? 'border-v-light-border/40 dark:border-v-border/40 opacity-50 cursor-not-allowed'
                        : 'border-v-light-border/70 dark:border-v-border/70 hover:border-v-accent/50'
                    }`}
                    aria-current={step.isActive ? 'step' : undefined}
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                        step.isComplete && step.isVisited
                          ? 'bg-v-accent text-white border-v-accent'
                          : step.isActive
                          ? 'border-v-accent text-v-accent'
                          : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary'
                      }`}
                    >
                      {step.isComplete && step.isVisited ? <CheckIcon className="h-4 w-4" /> : step.index + 1}
                    </span>
                    <div className="flex-1 pr-2">
                      <p className={`text-sm font-semibold ${!isClickable ? 'text-v-light-text-secondary dark:text-v-text-secondary' : 'text-v-light-text-primary dark:text-v-text-primary'}`}>
                        {step.label}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main Content */}
          <div className="space-y-6">
            <WizardStepHeader currentStepIndex={currentStepIndex} wizardSteps={WIZARD_STEPS} />
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep.id}
                custom={direction}
                variants={wizardStepVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-6 shadow-xl backdrop-blur-xl"
              >
                {renderStepContent()}
              </motion.div>
            </AnimatePresence>

            {/* Navigation Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-transparent border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary rounded-md text-sm transition-transform duration-150 active:scale-95"
              >
                Cancel
              </button>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {currentStepIndex > 0 && (
                  <button
                    onClick={handlePrevStep}
                    className="px-4 py-2 bg-v-light-hover dark:bg-v-light-dark hover:bg-v-light-border dark:hover:bg-v-border text-v-light-text-primary dark:text-v-text-primary font-semibold text-sm transition-all duration-150 rounded-md active:scale-95"
                  >
                    Previous
                  </button>
                )}
                {!isLastStep && (
                  <button
                    onClick={handleNextStep}
                    className="px-4 py-2 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-all duration-150 rounded-md active:scale-95"
                  >
                    Next
                  </button>
                )}
                {isLastStep && (
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-all duration-150 rounded-md active:scale-95"
                  >
                    {saveLabel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Edit mode - simpler layout without sidebar */
        <div className="space-y-6">
          <div className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-6">
            {renderStepContent()}
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-transparent border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary rounded-md text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm rounded-md"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
