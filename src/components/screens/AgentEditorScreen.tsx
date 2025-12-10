import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { Agent, AgentModel, AgentScope, Tool, ToolCategory, ToolRisk } from '../../types';
import { AVAILABLE_TOOLS, AVAILABLE_COLORS } from '../../constants';
import { CodeEditor } from '../CodeEditor';
import { AgentPreviewCard } from '../AgentPreviewCard';
import { wizardStepVariants } from '../../animations';
import { InputField, TextareaField } from '../form';
import { RiskBadge, ToolsSelector } from '../tools';
import { WizardStepHeader } from '../wizard';
import { CheckIcon } from '../icons/CheckIcon';
import { WarningIcon } from '../icons/WarningIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { extractProjectRootFromAgentPath } from '../../utils/path';
import { devLog } from '../../utils/devLogger';
import { serializeFrontmatter } from '../../utils/frontmatter';
import { emptyToolsValue, toolsSelectionToValue, toolsValueToArray } from '../../utils/toolHelpers';
import { checkClaudeCliInstalled } from '../../utils/tauriCommands';
import { generateAgentWithClaudeCode } from '../../utils/claudeCodeService';

interface AgentEditorScreenProps {
  agent: Agent;
  onSave: (agent: Agent, options?: { projectPath?: string }) => void;
  onCancel: () => void;
  mode: 'create' | 'edit' | 'duplicate';
  existingNames: string[];
}

type WizardStepId =
  | 'scope'
  | 'creationMethod'
  | 'agentDescription'
  | 'identifier'
  | 'prompt'
  | 'description'
  | 'tools'
  | 'model'
  | 'color'
  | 'review';

type CreationMethod = 'manual' | 'automatic';

const WIZARD_STEPS: { id: WizardStepId; label: string; description: string; required: boolean }[] = [
  {
    id: 'scope',
    label: 'Location',
    description: 'Choose whether this agent lives in the project or your personal library.',
    required: true
  },
  {
    id: 'creationMethod',
    label: 'Creation Method',
    description: 'Choose how you want to create this agent.',
    required: true
  },
  {
    id: 'agentDescription',
    label: 'Describe Your Agent',
    description: 'Tell Claude what kind of agent you want to create.',
    required: false // Only shown for automatic mode
  },
  {
    id: 'identifier',
    label: 'Agent identifier',
    description: 'Create a lowercase, hyphenated name that Claude will use.',
    required: true
  },
  {
    id: 'prompt',
    label: 'System prompt',
    description: 'Write comprehensive instructions for the agent.',
    required: true
  },
  {
    id: 'description',
    label: 'Description',
    description: 'Tell Claude when to use this agent.',
    required: true
  },
  {
    id: 'tools',
    label: 'Tools',
    description: 'Select which tools the agent may call.',
    required: false
  },
  {
    id: 'model',
    label: 'Model',
    description: 'Balance speed and reasoning with the right model choice.',
    required: false
  },
  {
    id: 'color',
    label: 'Colour',
    description: "Choose a colour for Claude's /agents UI.",
    required: false
  },
  {
    id: 'review',
    label: 'Review & Save',
    description: 'Confirm details before writing to disk.',
    required: false
  },
];

const COLOR_BG_MAP: Record<string, string> = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

const TOOL_CATEGORY_ORDER: ToolCategory[] = ['Read-only', 'Edit', 'Execution', 'Other'];

const RISK_WEIGHT: Record<ToolRisk, number> = {
  [ToolRisk.High]: 3,
  [ToolRisk.Medium]: 2,
  [ToolRisk.Low]: 1,
  [ToolRisk.Unknown]: 0,
};

const SCOPE_DETAILS: Record<AgentScope, { title: string; description: string; path: string }> = {
  [AgentScope.Global]: {
    title: 'Global agent',
    description: 'Saved inside ~/.claude/agents/ and available in every project you open.',
    path: '~/.claude/agents/'
  },
  [AgentScope.Project]: {
    title: 'Project agent',
    description: 'Saved inside .claude/agents/ for this project. Perfect for project-specific helpers.',
    path: '.claude/agents/'
  },
};

const MODEL_CHOICES: Array<{
  value: 'default' | 'opus' | 'haiku' | 'inherit';
  title: string;
  description: string;
  badge?: string;
}> = [
  {
    value: 'default',
    title: 'Sonnet',
    description: 'Balanced speed and reasoning — ideal starting point for most agents.',
    badge: 'Recommended'
  },
  {
    value: 'opus',
    title: 'Opus',
    description: 'Most capable option for deep, complex reasoning tasks.'
  },
  {
    value: 'haiku',
    title: 'Haiku',
    description: 'Fast and lightweight for simple checks or utility agents.'
  },
  {
    value: 'inherit',
    title: 'Inherit from parent',
    description: 'Use the same model as the parent conversation when executed.'
  }
];


export const AgentEditorScreen: React.FC<AgentEditorScreenProps> = ({ agent, onSave, onCancel, mode, existingNames }) => {
  const [formData, setFormData] = useState<Agent>(agent);
  const [nameError, setNameError] = useState('');
  const [projectFolderPath, setProjectFolderPath] = useState('');
  const [projectFolderError, setProjectFolderError] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);
  const [showRawFrontmatter, setShowRawFrontmatter] = useState(false);
  const [rawFrontmatterText, setRawFrontmatterText] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [hasReachedReview, setHasReachedReview] = useState(false);
  const [direction, setDirection] = useState(1);

  // Automatic agent generation state
  const [creationMethod, setCreationMethod] = useState<CreationMethod>('manual');
  const [claudeCliAvailable, setClaudeCliAvailable] = useState<boolean | null>(null);
  const [isGeneratingAgent, setIsGeneratingAgent] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [agentDescriptionInput, setAgentDescriptionInput] = useState('');

  const isWizard = mode !== 'edit';

  useEffect(() => {
    setFormData(agent);
  }, [agent]);

  useEffect(() => {
    if (agent.scope === AgentScope.Project) {
      setProjectFolderPath(extractProjectRootFromAgentPath(agent.path) || '');
    } else {
      setProjectFolderPath('');
    }
  }, [agent]);

  useEffect(() => {
    setCurrentStepIndex(0);
    setVisitedSteps(new Set([0]));
  }, [agent, mode]);

  useEffect(() => {
    setRawFrontmatterText(serializeFrontmatter(formData.frontmatter));
  }, [formData.frontmatter]);

  const validateName = useCallback(
    (nameValue: string) => {
      if (!nameValue) {
        setNameError('Name is required.');
        return false;
      }
      if (!/^[a-z-]+$/.test(nameValue)) {
        setNameError('Use lowercase letters and hyphens only (e.g., code-reviewer).');
        return false;
      }
      if (existingNames.includes(nameValue)) {
        setNameError('This name is already taken. Choose a unique identifier.');
        return false;
      }
      setNameError('');
      return true;
    },
    [existingNames]
  );

  useEffect(() => {
    validateName(formData.frontmatter.name);
  }, [formData.frontmatter.name, validateName]);

  const trimmedDescription = (formData.frontmatter.description || '').trim();
  const descriptionTooShort = trimmedDescription.length > 0 && trimmedDescription.length < 40;

  // Validate project folder selection
  useEffect(() => {
    if (formData.scope === AgentScope.Project && !projectFolderPath && visitedSteps.has(0)) {
      setProjectFolderError('Please select a project folder');
    } else {
      setProjectFolderError('');
    }
  }, [formData.scope, projectFolderPath, visitedSteps]);

  // Check if Claude CLI is installed for automatic agent generation
  useEffect(() => {
    let cancelled = false;
    async function checkCli() {
      try {
        const available = await checkClaudeCliInstalled();
        if (!cancelled) {
          setClaudeCliAvailable(available);
        }
      } catch (error) {
        devLog.error('Failed to check Claude CLI:', error);
        if (!cancelled) {
          setClaudeCliAvailable(false);
        }
      }
    }
    checkCli();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'scope') {
      setFormData((prev) => ({ ...prev, scope: value as AgentScope }));
      return;
    }

    if (name === 'model') {
      setFormData((prev) => ({
        ...prev,
        frontmatter: { ...prev.frontmatter, model: value === 'default' ? undefined : (value as AgentModel) },
      }));
      return;
    }

    if (name === 'color') {
      setFormData((prev) => ({
        ...prev,
        frontmatter: { ...prev.frontmatter, color: value || undefined },
      }));
      return;
    }

    // Auto-convert agent identifier to lowercase
    if (name === 'name') {
      const lowercaseValue = value.toLowerCase();
      setFormData((prev) => ({
        ...prev,
        frontmatter: { ...prev.frontmatter, name: lowercaseValue },
        name: lowercaseValue,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      frontmatter: { ...prev.frontmatter, [name]: value },
    }));
  };

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, body: e.target.value }));
  };

  // Handler for automatic agent generation with Claude Code
  const handleAutomaticGeneration = async () => {
    if (!agentDescriptionInput.trim() || isGeneratingAgent) return;

    setIsGeneratingAgent(true);
    setGenerationError(null);

    try {
      const result = await generateAgentWithClaudeCode(agentDescriptionInput, formData.scope);

      if (!result.success || !result.fields) {
        setGenerationError(result.error || 'Generation failed');
        return;
      }

      // Populate form with generated fields
      setFormData((prev) => ({
        ...prev,
        name: result.fields!.name,
        frontmatter: {
          ...prev.frontmatter,
          name: result.fields!.name,
          description: result.fields!.description,
          model: result.fields!.model,
          tools: result.fields!.tools ? result.fields!.tools.join(',') : undefined,
          color: result.fields!.color,
        },
        body: result.fields!.systemPrompt,
      }));

      // Mark all steps as visited and jump to review
      setVisitedSteps(new Set(WIZARD_STEPS.map((_, i) => i)));
      setHasReachedReview(true);

      // Navigate to review step
      const reviewIndex = WIZARD_STEPS.findIndex((s) => s.id === 'review');
      if (reviewIndex >= 0) {
        setDirection(1);
        setCurrentStepIndex(reviewIndex);
      }
    } catch (error) {
      devLog.error('Error during automatic agent generation:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsGeneratingAgent(false);
    }
  };

  const toolCategories = useMemo(() => {
    return AVAILABLE_TOOLS.reduce((acc, tool) => {
      if (!acc[tool.category]) {
        acc[tool.category] = [];
      }
      acc[tool.category].push(tool);
      return acc;
    }, {} as Record<ToolCategory, Tool[]>);
  }, []);

  const allToolNames = useMemo(() => AVAILABLE_TOOLS.map((tool) => tool.name), []);
  const inheritsAllTools = formData.frontmatter.tools === undefined;

  const selectedTools = useMemo(() => {
    if (inheritsAllTools) {
      return new Set(allToolNames);
    }
    return new Set(toolsValueToArray(formData.frontmatter.tools));
  }, [formData.frontmatter.tools, inheritsAllTools, allToolNames]);

  const updateToolsSelection = useCallback(
    (updater: (currentSelection: Set<string>) => Set<string>) => {
      setFormData((prev) => {
        const baseList =
          prev.frontmatter.tools === undefined
            ? allToolNames
            : toolsValueToArray(prev.frontmatter.tools);
        const nextSelection = updater(new Set(baseList));
        const normalized = Array.from(nextSelection).sort();
        const nextValue = toolsSelectionToValue(normalized, prev.frontmatter.tools, allToolNames.length);
        return {
          ...prev,
          frontmatter: { ...prev.frontmatter, tools: nextValue },
        };
      });
    },
    [allToolNames]
  );

  const handleToolsChange = (toolName: string, checked: boolean) => {
    updateToolsSelection((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(toolName);
      } else {
        next.delete(toolName);
      }
      return next;
    });
  };

  const handleCategoryToggle = (category: ToolCategory, checked: boolean) => {
    const categoryTools = toolCategories[category] || [];
    updateToolsSelection((current) => {
      const next = new Set(current);
      categoryTools.forEach((tool) => {
        if (checked) {
          next.add(tool.name);
        } else {
          next.delete(tool.name);
        }
      });
      return next;
    });
  };

  const handleAllToolsToggle = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      frontmatter: {
        ...prev.frontmatter,
        tools: checked ? undefined : emptyToolsValue(prev.frontmatter.tools),
      },
    }));
  };

  const categoryStates = useMemo(() => {
    const state: Record<string, { checked: boolean; indeterminate: boolean }> = {};
    const selectedCount = selectedTools.size;
    state.all = {
      checked: inheritsAllTools || selectedCount === allToolNames.length,
      indeterminate: !inheritsAllTools && selectedCount > 0 && selectedCount < allToolNames.length,
    };

    TOOL_CATEGORY_ORDER.forEach((category) => {
      const tools = toolCategories[category] || [];
      const total = tools.length;
      const count = tools.filter((tool) => selectedTools.has(tool.name)).length;
      state[category] = {
        checked: total > 0 && count === total,
        indeterminate: count > 0 && count < total,
      };
    });

    return state;
  }, [allToolNames.length, inheritsAllTools, selectedTools, toolCategories]);

  const { overallRisk, riskSummaryText } = useMemo(() => {
    if (inheritsAllTools) {
      return {
        overallRisk: ToolRisk.Unknown,
        riskSummaryText: 'Varied risk — inherits every tool from the active Claude session.',
      };
    }
    if (selectedTools.size === 0) {
      return {
        overallRisk: ToolRisk.Low,
        riskSummaryText: 'No tools selected. The agent cannot call tools until you add some.',
      };
    }

    let riskiest = ToolRisk.Low;
    selectedTools.forEach((toolName) => {
      const info = AVAILABLE_TOOLS.find((tool) => tool.name === toolName);
      const risk = info ? info.risk : ToolRisk.Unknown;
      if (RISK_WEIGHT[risk] > RISK_WEIGHT[riskiest]) {
        riskiest = risk;
      }
    });

    const summaryMap: Record<ToolRisk, string> = {
      [ToolRisk.High]: 'Execution tools selected. Double-check before saving.',
      [ToolRisk.Medium]: 'Edit/write tools selected. Good balance of capability and safety.',
      [ToolRisk.Low]: 'Read-only tools only. Very safe configuration.',
      [ToolRisk.Unknown]: 'Contains tools with unknown risk levels.',
    };

    return {
      overallRisk: riskiest,
      riskSummaryText: summaryMap[riskiest],
    };
  }, [inheritsAllTools, selectedTools]);

  const canSave = !nameError && trimmedDescription.length > 0;

  const currentStep = WIZARD_STEPS[currentStepIndex] ?? WIZARD_STEPS[0];
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  // Define isStepComplete first (needed by getNextIncompleteStep)
  // Get visible steps based on creation method
  const getVisibleSteps = useCallback(() => {
    if (creationMethod === 'automatic') {
      // For automatic: scope -> creationMethod -> agentDescription -> review
      return WIZARD_STEPS.filter((s) =>
        ['scope', 'creationMethod', 'agentDescription', 'review'].includes(s.id)
      );
    }
    // For manual: all steps except agentDescription
    return WIZARD_STEPS.filter((s) => s.id !== 'agentDescription');
  }, [creationMethod]);

  const visibleSteps = useMemo(() => getVisibleSteps(), [getVisibleSteps]);

  const isStepComplete = (stepId: WizardStepId) => {
    switch (stepId) {
      case 'scope':
        return Boolean(formData.scope) && (formData.scope === AgentScope.Global || Boolean(projectFolderPath));
      case 'creationMethod':
        return Boolean(creationMethod);
      case 'agentDescription':
        return Boolean(agentDescriptionInput.trim());
      case 'identifier':
        return !nameError && Boolean(formData.frontmatter.name);
      case 'prompt':
        return Boolean(formData.body.trim());
      case 'description':
        return trimmedDescription.length > 0;
      case 'tools':
        return inheritsAllTools || selectedTools.size > 0;
      case 'model':
      case 'color':
        return true;
      case 'review':
        return canSave;
      default:
        return false;
    }
  };

  // Calculate completion percentage for required fields (dynamic based on creation method)
  const getCompletionPercentage = () => {
    if (creationMethod === 'automatic') {
      // For automatic: scope + folder (if project) + description input
      const requiredChecks = [
        Boolean(formData.scope),
        formData.scope === AgentScope.Global || Boolean(projectFolderPath),
        Boolean(agentDescriptionInput.trim()),
      ];
      const completed = requiredChecks.filter(Boolean).length;
      return Math.round((completed / requiredChecks.length) * 100);
    }
    // For manual: original checks
    const requiredChecks = [
      Boolean(formData.scope), // Scope selected
      formData.scope === AgentScope.Global || Boolean(projectFolderPath), // Folder if project
      !nameError && Boolean(formData.frontmatter.name), // Valid identifier
      Boolean(formData.body.trim()), // System prompt present
      trimmedDescription.length > 0, // Description present
    ];

    const completed = requiredChecks.filter(Boolean).length;
    return Math.round((completed / requiredChecks.length) * 100);
  };

  const completionPercentage = getCompletionPercentage();

  // Get next incomplete step (among visible steps)
  const getNextIncompleteStep = (): number | null => {
    for (let i = 0; i < WIZARD_STEPS.length; i++) {
      const step = WIZARD_STEPS[i];
      // Skip steps that aren't visible for current creation method
      if (!visibleSteps.some((vs) => vs.id === step.id)) continue;
      if (!isStepComplete(step.id)) {
        return i;
      }
    }
    return null;
  };

  const nextIncompleteStepIndex = getNextIncompleteStep();

  const canProceedFromStep = (stepId: WizardStepId) => {
    switch (stepId) {
      case 'scope':
        // If project scope is selected, folder must be selected
        return formData.scope === AgentScope.Global || (formData.scope === AgentScope.Project && Boolean(projectFolderPath));
      case 'creationMethod':
        return Boolean(creationMethod);
      case 'agentDescription':
        // For automatic mode, can't proceed while generating
        return !isGeneratingAgent && Boolean(agentDescriptionInput.trim());
      case 'identifier':
        return !nameError && Boolean(formData.frontmatter.name);
      case 'description':
        return trimmedDescription.length > 0;
      case 'review':
        return canSave;
      default:
        return true;
    }
  };

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
    const clamped = Math.max(0, Math.min(nextIndex, WIZARD_STEPS.length - 1));
    if (clamped === currentStepIndex) return;

    // Allow going backwards freely, but check completion for forward navigation
    const isGoingBack = clamped < currentStepIndex;
    const isReviewStep = WIZARD_STEPS[clamped].id === 'review';

    if (!isGoingBack && !canNavigateToStep(clamped)) {
      return;
    }
    if (isReviewStep && !canNavigateToStep(clamped)) {
      return;
    }

    setDirection(clamped > currentStepIndex ? 1 : -1);
    setCurrentStepIndex(clamped);
    setVisitedSteps((prev) => {
      const updated = new Set(prev);
      updated.add(clamped);
      return updated;
    });
    // Mark that user has reached review, enabling free navigation
    if (isReviewStep) {
      setHasReachedReview(true);
    }
  }, [currentStepIndex, canNavigateToStep]);

  const handleNextStep = () => {
    if (!canProceedFromStep(currentStep.id)) return;
    if (!isLastStep) {
      goToStep(currentStepIndex + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex === 0) return;
    goToStep(currentStepIndex - 1);
  };

  const handleWizardKeyDown = (event: React.KeyboardEvent) => {
    if (!isWizard) return;
    if (event.defaultPrevented) return;
    if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const tagName = target?.tagName?.toLowerCase();
    const isTextArea = tagName === 'textarea';
    const isContentEditable = target?.isContentEditable;
    const isCustomTextbox = target?.getAttribute('role') === 'textbox';

    if (isTextArea || isContentEditable || isCustomTextbox) {
      return;
    }

    if (isLastStep || !canProceedFromStep(currentStep.id)) {
      return;
    }

    event.preventDefault();
    goToStep(currentStepIndex + 1);
  };

  const resolveProjectPathForSave = () => {
    if (formData.scope !== AgentScope.Project) {
      return undefined;
    }
    return projectFolderPath || extractProjectRootFromAgentPath(formData.path) || undefined;
  };

  const handleSaveClick = () => {
    if (!canSave) {
      return;
    }
    const projectPath = resolveProjectPathForSave();
    onSave(formData, projectPath ? { projectPath } : undefined);
  };

  // Keyboard shortcuts: Cmd/Ctrl+Enter to save on review step
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle Cmd/Ctrl+Enter
      if (!((e.metaKey || e.ctrlKey) && e.key === 'Enter')) return;

      // Don't trigger if focus is in a textarea (unless it's the agent description which has its own handler)
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' && target.id !== 'agent-description-input') return;

      e.preventDefault();

      // Get current visible steps
      const visibleStepsForKeyboard = creationMethod === 'automatic'
        ? WIZARD_STEPS.filter((s) => ['scope', 'creationMethod', 'agentDescription', 'review'].includes(s.id))
        : WIZARD_STEPS.filter((s) => s.id !== 'agentDescription');

      const currentVisibleIndex = visibleStepsForKeyboard.findIndex(s => s.id === WIZARD_STEPS[currentStepIndex]?.id);
      const currentVisibleStep = visibleStepsForKeyboard[currentVisibleIndex];

      // On review step, trigger save
      if (currentVisibleStep?.id === 'review' && canSave) {
        const projectPath = resolveProjectPathForSave();
        onSave(formData, projectPath ? { projectPath } : undefined);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentStepIndex, creationMethod, canSave, formData, onSave, projectFolderPath]);

  const handleProjectFolderPick = async (event?: React.MouseEvent) => {
    if (event) event.stopPropagation();
    if (isPickingProjectFolder) return;

    setIsPickingProjectFolder(true);
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory'
      });

      if (!selectedPath || Array.isArray(selectedPath)) {
        return;
      }

      setProjectFolderPath(selectedPath);
      setProjectFolderError('');
      // Set scope to Project after successful folder selection
      setFormData((prev) => ({ ...prev, scope: AgentScope.Project }));
    } catch (error) {
      devLog.error('Failed to select project folder:', error);
      setProjectFolderError('Unable to open the folder picker. Please try again.');
    } finally {
      setIsPickingProjectFolder(false);
    }
  };

  const handleScopeChange = (scope: AgentScope) => {
    if (scope === AgentScope.Project && !projectFolderPath) {
      // Trigger folder picker when switching to Project without a folder
      handleProjectFolderPick();
    } else {
      setFormData((prev) => ({ ...prev, scope }));
    }
  };

  const toolsSummaryLabel = inheritsAllTools
    ? 'Inheriting all session tools'
    : `${selectedTools.size} tool${selectedTools.size === 1 ? '' : 's'} selected`;

  const reviewWarnings: string[] = [];
  if (descriptionTooShort) {
    reviewWarnings.push('Description looks short. Consider describing when Claude should delegate to this agent.');
  }
  if (!formData.body.trim()) {
    reviewWarnings.push('System prompt is empty. Claude will only rely on the short description.');
  }

  const resolvedModelValue = (formData.frontmatter.model || 'default') as 'default' | 'opus' | 'haiku' | 'inherit';

  const handleModelChoice = (choice: 'default' | 'opus' | 'haiku' | 'inherit') => {
    setFormData(prev => ({
      ...prev,
      frontmatter: {
        ...prev.frontmatter,
        model: choice === 'default' ? undefined : choice
      }
    }));
  };

  const renderStepContent = () => {
    switch (currentStep.id) {
      case 'scope':
        return (
          <div className="space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              {(Object.keys(SCOPE_DETAILS) as AgentScope[]).map((scope) => {
                const detail = SCOPE_DETAILS[scope];
                const selected = formData.scope === scope;
                const isProjectScope = scope === AgentScope.Project;
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => handleScopeChange(scope)}
                    className={`relative text-left border rounded-lg p-4 transition-colors duration-150 ${
                      selected
                        ? isProjectScope && projectFolderError
                          ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/10'
                          : 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
                        : 'border-v-light-border dark:border-v-border hover:border-v-accent'
                    }`}
                  >
                    {/* Folder picker button - only shown when project is selected and has a path */}
                    {isProjectScope && selected && projectFolderPath && (
                      <div className="absolute top-3 right-3">
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProjectFolderPick(e);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleProjectFolderPick();
                            }
                          }}
                          className={`p-1.5 rounded-md transition-colors hover:bg-v-light-border dark:hover:bg-v-border ${isPickingProjectFolder ? 'cursor-wait opacity-80' : 'cursor-pointer'}`}
                          aria-label="Change project folder"
                          title="Change project folder"
                        >
                          {isPickingProjectFolder ? (
                            <SpinnerIcon className="h-4 w-4 text-v-accent" />
                          ) : (
                            <FolderIcon className="h-4 w-4 text-v-accent" />
                          )}
                        </div>
                      </div>
                    )}
                    <p className="text-sm font-bold text-v-light-text-primary dark:text-v-text-primary">{detail.title}</p>
                    <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">{detail.description}</p>
                    <p className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary mt-2">
                      {isProjectScope && projectFolderPath
                        ? `Saved in ${projectFolderPath.replace(/^\/Users\/([^/]+)/, '~').replace(/^C:\\Users\\([^\\]+)/, '~')}/.claude/agents/`
                        : isProjectScope
                        ? 'Click to choose a project folder'
                        : `Location: ${detail.path}`}
                    </p>
                  </button>
                );
              })}
            </div>
            {projectFolderError && formData.scope === AgentScope.Project && (
              <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <WarningIcon className="h-4 w-4" />
                {projectFolderError}
              </p>
            )}
          </div>
        );
      case 'creationMethod':
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Manual Option */}
              <button
                type="button"
                onClick={() => setCreationMethod('manual')}
                className={`text-left border rounded-lg p-4 transition-colors duration-150 ${
                  creationMethod === 'manual'
                    ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
                    : 'border-v-light-border dark:border-v-border hover:border-v-accent'
                }`}
              >
                <p className="text-sm font-bold text-v-light-text-primary dark:text-v-text-primary">
                  Manual
                </p>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                  Configure each field step-by-step with full control over the agent definition.
                </p>
              </button>

              {/* Automatic Option */}
              <button
                type="button"
                onClick={() => claudeCliAvailable && setCreationMethod('automatic')}
                disabled={!claudeCliAvailable}
                className={`text-left border rounded-lg p-4 transition-colors duration-150 ${
                  creationMethod === 'automatic'
                    ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark'
                    : claudeCliAvailable
                      ? 'border-v-light-border dark:border-v-border hover:border-v-accent'
                      : 'border-v-light-border dark:border-v-border opacity-50 cursor-not-allowed'
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-v-light-text-primary dark:text-v-text-primary">
                    Automatic
                  </p>
                  {claudeCliAvailable === null && (
                    <SpinnerIcon className="h-3 w-3 text-v-light-text-secondary dark:text-v-text-secondary" />
                  )}
                  {claudeCliAvailable === false && (
                    <span className="text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full">
                      CLI not found
                    </span>
                  )}
                </div>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                  Describe what you want and let Claude Code generate the agent for you.
                </p>
              </button>
            </div>

            {/* CLI Not Installed Warning */}
            {claudeCliAvailable === false && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <WarningIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                      Claude Code CLI not installed
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                      To use automatic agent generation, install Claude Code CLI.
                    </p>
                    <a
                      href="https://docs.anthropic.com/en/docs/claude-code/getting-started"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-v-accent hover:underline mt-2 inline-block"
                    >
                      View installation instructions →
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'agentDescription':
        return (
          <div className="space-y-4">
            <TextareaField
              label="Describe your agent"
              id="agent-description-input"
              name="agentDescriptionInput"
              value={agentDescriptionInput}
              onChange={(e) => setAgentDescriptionInput(e.target.value)}
              onKeyDown={(e) => {
                // Cmd/Ctrl+Enter to generate
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && agentDescriptionInput.trim() && !isGeneratingAgent) {
                  e.preventDefault();
                  handleAutomaticGeneration();
                }
              }}
              rows={6}
              placeholder="e.g., I need an agent that reviews Python code for security vulnerabilities, focusing on common issues like SQL injection, XSS, and improper input validation. It should be thorough but friendly in its feedback."
              hint="Be specific about what the agent should do, its expertise area, and any special behaviors. Press ⌘Enter to generate."
            />

            {generationError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <WarningIcon className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-200">
                      Generation failed
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {generationError}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleAutomaticGeneration}
              disabled={!agentDescriptionInput.trim() || isGeneratingAgent}
              className="w-full px-4 py-3 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-all duration-150 disabled:bg-v-light-border dark:disabled:bg-v-border disabled:text-v-light-text-secondary dark:disabled:text-v-text-secondary disabled:cursor-not-allowed rounded-lg flex items-center justify-center gap-2"
            >
              {isGeneratingAgent ? (
                <>
                  <SpinnerIcon className="h-4 w-4 animate-spin" />
                  Generating with Claude Code...
                </>
              ) : (
                'Generate Agent'
              )}
            </button>

            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
              Claude Code will create an agent based on your description. You can review and edit it before saving.
            </p>
          </div>
        );
      case 'identifier':
        return (
          <div>
          <InputField
            label="Agent Identifier"
            id="wizard-name"
            name="name"
            mono
            value={formData.frontmatter.name}
            onChange={handleChange}
            required
            hint="Lowercase letters and hyphens only."
            error={nameError}
          />
          </div>
        );
      case 'prompt':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="wizard-body" className="block text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary">
                System prompt
              </label>
              <CodeEditor
                id="wizard-body"
                value={formData.body}
                onChange={handleBodyChange}
                rows={14}
                placeholder="e.g. You are a helpful agent that assists with code review..."
              />
            </div>
            <div className="space-y-2 p-4 bg-v-light-hover/30 dark:bg-v-light-dark/30 rounded-lg border border-v-light-border/50 dark:border-v-border/50">
              <p className="text-xs font-semibold text-v-light-text-primary dark:text-v-text-primary">
                💡 Best practices for system prompts:
              </p>
              <ul className="text-xs text-v-light-text-secondary dark:text-v-text-secondary space-y-1 list-disc list-inside">
                <li><strong>Be specific:</strong> Treat Claude like a new employee—provide explicit instructions, context, and success criteria</li>
                <li><strong>Define the role:</strong> Clearly state what the agent does and its area of expertise</li>
                <li><strong>Use examples:</strong> Include 2-3 concrete examples showing desired input/output format</li>
                <li><strong>Structure with XML:</strong> Use tags like &lt;instructions&gt;, &lt;examples&gt;, &lt;context&gt; for clarity</li>
                <li><strong>Specify outputs:</strong> State exact format, length, and tone requirements</li>
                <li><strong>Single responsibility:</strong> Focus on one clear task rather than multiple responsibilities</li>
              </ul>
            </div>
          </div>
        );
      case 'description':
        return (
          <TextareaField
            label="Description (tell Claude when to use this agent)"
            id="wizard-description"
            name="description"
            value={formData.frontmatter.description}
            onChange={handleChange}
            rows={5}
            placeholder="e.g. Use this agent when reviewing code for security vulnerabilities..."
            hint="Start with 'Use this agent when…' and mention triggers, contexts, or exclusions."
            warning={descriptionTooShort ? 'Descriptions under 40 characters may be too vague for delegations.' : undefined}
          />
        );
      case 'tools':
        return (
          <div className="space-y-3">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Pick categories or individual tools. Selecting every tool omits the field so the agent inherits the full session toolset.
            </p>
            <ToolsSelector
              toolsSummaryLabel={toolsSummaryLabel}
              categoryStates={categoryStates}
              handleAllToolsToggle={handleAllToolsToggle}
              toolCategoryOrder={TOOL_CATEGORY_ORDER}
              handleCategoryToggle={handleCategoryToggle}
              overallRisk={overallRisk}
              riskSummaryText={riskSummaryText}
              toolCategories={toolCategories}
              selectedTools={selectedTools}
              handleToolsChange={handleToolsChange}
            />
          </div>
        );
      case 'model':
        return (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">Select model</p>
              <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                Model choice balances speed and reasoning depth for the agent.
              </p>
            </div>
            <div className="space-y-3">
              {MODEL_CHOICES.map(choice => {
                const isSelected = resolvedModelValue === choice.value;
                return (
                  <button
                    type="button"
                    key={choice.value}
                    onClick={() => handleModelChoice(choice.value)}
                    className={`w-full text-left border rounded-xl px-4 py-3 flex items-start gap-4 transition-all ${
                      isSelected
                        ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark shadow-sm'
                        : 'border-v-light-border dark:border-v-border hover:border-v-accent'
                    }`}
                  >
                    <span
                      className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                        isSelected
                          ? 'border-v-accent bg-v-accent text-white'
                          : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary'
                      }`}
                    >
                      {isSelected ? <CheckIcon className="h-3 w-3" /> : ''}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                          {choice.title}
                        </p>
                        {choice.badge && (
                          <span className="text-[10px] uppercase tracking-wide text-white bg-v-accent px-2 py-0.5 rounded-full">
                            {choice.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        {choice.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      case 'color':
        return (
          <div className="space-y-2">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Pick a colour swatch for Claude's /agents UI.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <label className={`flex items-center gap-3 border rounded-md px-3 py-2 cursor-pointer ${!formData.frontmatter.color ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark' : 'border-v-light-border dark:border-v-border hover:border-v-accent'}`}>
                <input
                  type="radio"
                  className="sr-only"
                  name="color"
                  value=""
                  checked={!formData.frontmatter.color}
                  onChange={handleChange}
                />
                <span className="h-5 w-5 rounded-full border border-v-light-border dark:border-v-border bg-black dark:bg-white" />
                <span className="text-sm text-v-light-text-primary dark:text-v-text-primary">Automatic</span>
              </label>
              {AVAILABLE_COLORS.map((color) => (
                <label
                  key={color}
                  className={`flex items-center gap-3 border rounded-md px-3 py-2 cursor-pointer transition-colors duration-150 ${formData.frontmatter.color === color ? 'border-v-accent bg-v-light-hover dark:bg-v-light-dark' : 'border-v-light-border dark:border-v-border hover:border-v-accent'}`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="color"
                    value={color}
                    checked={formData.frontmatter.color === color}
                    onChange={handleChange}
                  />
                  <span className={`h-5 w-5 rounded-full ${COLOR_BG_MAP[color] || 'bg-v-accent'}`} />
                  <span className="text-sm capitalize text-v-light-text-primary dark:text-v-text-primary">{color}</span>
                </label>
              ))}
            </div>
          </div>
        );
      case 'review':
        return (
          <div className="space-y-6">
            <AgentPreviewCard agent={formData} />
            {reviewWarnings.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 p-3 rounded-md text-sm space-y-1">
                {reviewWarnings.map((warning) => (
                  <div key={warning} className="flex items-start gap-2">
                    <WarningIcon className="h-4 w-4" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4 border-t border-v-light-border dark:border-v-border">
              <button
                type="button"
                onClick={() => setShowRawFrontmatter(!showRawFrontmatter)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors rounded-lg"
              >
                <span className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                  Raw frontmatter
                </span>
                <svg
                  className={`h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary transition-transform ${showRawFrontmatter ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
              {showRawFrontmatter && (
                <div className="mt-3">
                  <TextareaField label="Raw Frontmatter (read-only)" id="rawFrontmatter" value={rawFrontmatterText} onChange={() => {}} rows={8} />
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const title =
    mode === 'create' ? 'Create New Agent' : mode === 'duplicate' ? 'Duplicate Agent' : 'Edit Agent';
  const breadcrumbLabel =
    mode === 'create' ? 'Create New Agent' : mode === 'duplicate' ? 'Duplicate Agent' : `Edit ${agent.name}`;
  const saveLabel = mode === 'edit' ? 'Save Changes' : 'Save Agent';
  // Filter sidebar steps to only show visible ones based on creation method
  const visibleStepIds = new Set(visibleSteps.map((s) => s.id));
  const sidebarSteps = WIZARD_STEPS
    .map((step, index) => ({
      ...step,
      index,
      isActive: index === currentStepIndex,
      isComplete: isStepComplete(step.id),
      isVisited: visitedSteps.has(index),
      canNavigate: canNavigateToStep(index),
    }))
    .filter((step) => visibleStepIds.has(step.id));

  return (
    <div className="space-y-8" onKeyDownCapture={handleWizardKeyDown}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onCancel}
          className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
          {title}
        </h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px,1fr] overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr)', gap: '1.5rem' }}>
        <aside className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl p-5 space-y-4 min-w-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">Steps</p>
            <p className="text-base font-semibold text-v-light-text-primary dark:text-v-text-primary">Agent build overview</p>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-v-light-text-secondary dark:text-v-text-secondary">Progress</span>
              <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">{completionPercentage}%</span>
            </div>
            <div className="h-2 bg-v-light-border dark:bg-v-border rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-v-accent to-v-accent-hover rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              />
            </div>
          </div>
          <div className="space-y-2">
            {sidebarSteps.map((step) => {
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
                    {step.isComplete && step.isVisited ? (
                      <CheckIcon className="h-4 w-4" />
                    ) : (
                      step.index + 1
                    )}
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

        <div className="space-y-6 min-w-0 overflow-hidden">
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
                  onClick={handlePreviousStep}
                  className="px-4 py-2 bg-v-light-hover dark:bg-v-light-dark hover:bg-v-light-border dark:hover:bg-v-border text-v-light-text-primary dark:text-v-text-primary font-semibold text-sm transition-all duration-150 rounded-md active:scale-95"
                >
                  Previous
                </button>
              )}
              {!isLastStep && (
                <button
                  onClick={handleNextStep}
                  disabled={!canProceedFromStep(currentStep.id)}
                  className="px-4 py-2 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-all duration-150 disabled:bg-v-light-border dark:disabled:bg-v-border disabled:text-v-light-text-secondary dark:disabled:text-v-text-secondary disabled:cursor-not-allowed rounded-md active:scale-95"
                >
                  Next
                </button>
              )}
              {(!isWizard || isLastStep) && (
                <button
                  onClick={handleSaveClick}
                  disabled={!canSave}
                  className="px-4 py-2 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-all duration-150 disabled:bg-v-light-border dark:disabled:bg-v-border disabled:text-v-light-text-secondary dark:disabled:text-v-text-secondary disabled:cursor-not-allowed rounded-md active:scale-95"
                >
                  {saveLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
