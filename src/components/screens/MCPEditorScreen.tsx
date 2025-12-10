import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import {
  MCPServer,
  MCPServerType,
  MCPScope,
  MCP_SERVER_TEMPLATES,
  MCPServerTemplate,
  validateMCPServer,
  createMCPServerId,
} from '../../types/mcp';
import { wizardStepVariants } from '../../animations';
import { InputField, TextareaField } from '../form';
import { WizardStepHeader } from '../wizard';
import { CheckIcon } from '../icons/CheckIcon';
import { WarningIcon } from '../icons/WarningIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { ServerIcon } from '../icons/ServerIcon';
import { PlusIcon } from '../icons/PlusIcon';
import { DeleteIcon } from '../icons/DeleteIcon';

interface MCPEditorScreenProps {
  server: MCPServer | null;
  onSave: (server: MCPServer, projectPath?: string) => void;
  onCancel: () => void;
  mode: 'create' | 'edit';
  existingNames: string[];
  projectPath?: string;
}

type WizardStepId =
  | 'template'
  | 'type'
  | 'config'
  | 'args'
  | 'headers'
  | 'env'
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
    id: 'type',
    label: 'Server type',
    description: 'Select how Claude will connect to this MCP server.',
    required: true
  },
  {
    id: 'config',
    label: 'Server configuration',
    description: 'Configure the server name and connection details.',
    required: true
  },
  {
    id: 'args',
    label: 'Command arguments',
    description: 'Add command-line arguments for stdio servers.',
    required: false
  },
  {
    id: 'headers',
    label: 'HTTP headers',
    description: 'Add custom headers for HTTP/SSE servers.',
    required: false
  },
  {
    id: 'env',
    label: 'Environment variables',
    description: 'Define environment variables for the server.',
    required: false
  },
  {
    id: 'scope',
    label: 'Save location',
    description: 'Choose where to save this server configuration.',
    required: true
  },
  {
    id: 'review',
    label: 'Review & Save',
    description: 'Confirm details before saving.',
    required: false
  },
];

const SERVER_TYPE_OPTIONS: { value: MCPServerType; title: string; description: string }[] = [
  {
    value: 'stdio',
    title: 'Stdio (Local Process)',
    description: 'Runs a local command and communicates via stdin/stdout. Best for npx packages.'
  },
  {
    value: 'http',
    title: 'HTTP',
    description: 'Connects to a remote HTTP endpoint. Best for cloud-hosted MCP servers.'
  },
  {
    value: 'sse',
    title: 'SSE (Deprecated)',
    description: 'Server-Sent Events connection. Use HTTP instead for new servers.'
  }
];

const SCOPE_DETAILS: Record<MCPScope, { title: string; description: string; path: string }> = {
  user: {
    title: 'User (Global)',
    description: 'Saved to ~/.claude/mcp.json. Available in all your projects.',
    path: '~/.claude/mcp.json'
  },
  project: {
    title: 'Project',
    description: 'Saved to .mcp.json in the project root. Shared via git with your team.',
    path: '.mcp.json'
  },
  local: {
    title: 'Local (Private)',
    description: 'Saved to .claude/settings.local.json. Not tracked by git.',
    path: '.claude/settings.local.json'
  }
};

const createEmptyServer = (): MCPServer => ({
  id: '',
  name: '',
  type: 'stdio',
  scope: 'user',
  sourcePath: '',
  enabled: true,
});

export const MCPEditorScreen: React.FC<MCPEditorScreenProps> = ({
  server,
  onSave,
  onCancel,
  mode,
  existingNames,
  projectPath,
}) => {
  const [formData, setFormData] = useState<MCPServer>(server || createEmptyServer());
  const [nameError, setNameError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<MCPServerTemplate | null>(null);
  const [projectFolderPath, setProjectFolderPath] = useState(projectPath || '');
  const [projectFolderError, setProjectFolderError] = useState('');
  const [isPickingProjectFolder, setIsPickingProjectFolder] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<Set<number>>(new Set([0]));
  const [hasReachedReview, setHasReachedReview] = useState(false);
  const [direction, setDirection] = useState(1);

  // Key-value editors state
  const [headerEntries, setHeaderEntries] = useState<Array<{ key: string; value: string }>>([]);
  const [envEntries, setEnvEntries] = useState<Array<{ key: string; value: string }>>([]);
  const [argsEntries, setArgsEntries] = useState<string[]>([]);

  const isWizard = mode === 'create';

  useEffect(() => {
    if (server) {
      setFormData(server);
      // Initialize key-value entries from server data
      setHeaderEntries(
        Object.entries(server.headers || {}).map(([key, value]) => ({ key, value }))
      );
      setEnvEntries(
        Object.entries(server.env || {}).map(([key, value]) => ({ key, value }))
      );
      setArgsEntries(server.args || []);
    }
  }, [server]);

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
        setNameError('Server name is required.');
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

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, name: value }));
    if (value) validateName(value);
  };

  const handleTypeChange = (type: MCPServerType) => {
    setFormData(prev => ({ ...prev, type }));
  };

  const handleScopeChange = (scope: MCPScope) => {
    setFormData(prev => ({ ...prev, scope }));
    if (scope !== 'project') {
      setProjectFolderError('');
    }
  };

  const handleTemplateSelect = (template: MCPServerTemplate | null) => {
    setSelectedTemplate(template);
    if (template) {
      setFormData(prev => ({
        ...prev,
        name: template.name,
        type: template.type,
        url: template.config.url,
        command: template.config.command,
        args: template.config.args,
        headers: template.config.headers,
        env: template.config.env,
      }));
      setArgsEntries(template.config.args || []);
      setHeaderEntries(
        Object.entries(template.config.headers || {}).map(([key, value]) => ({ key, value }))
      );
      setEnvEntries(
        Object.entries(template.config.env || {}).map(([key, value]) => ({ key, value }))
      );
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

  // Step completion check - must be before canNavigateToStep
  const isStepComplete = useCallback((stepId: WizardStepId): boolean => {
    switch (stepId) {
      case 'template':
        return true; // Optional step
      case 'type':
        return Boolean(formData.type);
      case 'config':
        if (!formData.name) return false;
        if (formData.type === 'stdio' && !formData.command) return false;
        if ((formData.type === 'http' || formData.type === 'sse') && !formData.url) return false;
        return true;
      case 'args':
        return true; // Optional step
      case 'headers':
        return true; // Optional step
      case 'env':
        return true; // Optional step
      case 'scope':
        if (formData.scope === 'project' && !projectFolderPath) return false;
        return true;
      case 'review':
        return Boolean(formData.type) &&
          Boolean(formData.name) &&
          (formData.type !== 'stdio' || Boolean(formData.command)) &&
          ((formData.type !== 'http' && formData.type !== 'sse') || Boolean(formData.url)) &&
          (formData.scope !== 'project' || Boolean(projectFolderPath));
      default:
        return false;
    }
  }, [formData.type, formData.name, formData.command, formData.url, formData.scope, projectFolderPath]);

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
      // Skip steps that aren't visible for this server type
      if (step.id === 'args' && formData.type !== 'stdio') continue;
      if (step.id === 'headers' && formData.type === 'stdio') continue;
      // Check if this visited step is complete (required steps must be complete, optional are always ok)
      if (!step.required || isStepComplete(step.id)) {
        highestCompletedVisitedIndex = i;
      } else {
        // Found an incomplete required step - can't go past this
        break;
      }
    }

    // Can only navigate to the very next step after the highest completed visited step
    // Find what the next valid step index is (skipping hidden steps)
    let nextValidIndex = highestCompletedVisitedIndex + 1;
    while (nextValidIndex < WIZARD_STEPS.length) {
      const nextStep = WIZARD_STEPS[nextValidIndex];
      if (nextStep.id === 'args' && formData.type !== 'stdio') {
        nextValidIndex++;
        continue;
      }
      if (nextStep.id === 'headers' && formData.type === 'stdio') {
        nextValidIndex++;
        continue;
      }
      break;
    }

    return targetIndex === nextValidIndex;
  }, [formData.type, isStepComplete, hasReachedReview, visitedSteps]);

  const goToStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= WIZARD_STEPS.length) return;
    // Allow going backwards freely, but check completion for forward navigation
    const isGoingBack = nextIndex < currentStepIndex;
    const isReviewStep = WIZARD_STEPS[nextIndex].id === 'review';
    if (!isGoingBack && !isReviewStep && !canNavigateToStep(nextIndex)) {
      return; // Block forward navigation if previous steps incomplete
    }
    if (isReviewStep && !canNavigateToStep(nextIndex)) {
      return; // Block review if required steps incomplete
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
      if (formData.type === 'stdio' && !formData.command) {
        return; // Command required for stdio
      }
      if ((formData.type === 'http' || formData.type === 'sse') && !formData.url) {
        return; // URL required for http/sse
      }
    }

    if (currentStep.id === 'scope') {
      if (formData.scope === 'project' && !projectFolderPath) {
        setProjectFolderError('Please select a project folder.');
        return;
      }
    }

    // Skip irrelevant steps based on type
    let nextIndex = currentStepIndex + 1;
    while (nextIndex < WIZARD_STEPS.length) {
      const nextStep = WIZARD_STEPS[nextIndex];
      if (nextStep.id === 'args' && formData.type !== 'stdio') {
        nextIndex++;
        continue;
      }
      if (nextStep.id === 'headers' && formData.type === 'stdio') {
        nextIndex++;
        continue;
      }
      break;
    }

    goToStep(nextIndex);
  };

  const handlePrevStep = () => {
    let prevIndex = currentStepIndex - 1;
    while (prevIndex >= 0) {
      const prevStep = WIZARD_STEPS[prevIndex];
      if (prevStep.id === 'args' && formData.type !== 'stdio') {
        prevIndex--;
        continue;
      }
      if (prevStep.id === 'headers' && formData.type === 'stdio') {
        prevIndex--;
        continue;
      }
      break;
    }
    goToStep(prevIndex);
  };

  const handleSave = () => {
    // Build final server object
    const finalServer: MCPServer = {
      ...formData,
      id: createMCPServerId(formData.name, formData.scope),
      headers: headerEntries.length > 0
        ? Object.fromEntries(headerEntries.filter(e => e.key).map(e => [e.key, e.value]))
        : undefined,
      env: envEntries.length > 0
        ? Object.fromEntries(envEntries.filter(e => e.key).map(e => [e.key, e.value]))
        : undefined,
      args: argsEntries.length > 0 ? argsEntries.filter(Boolean) : undefined,
    };

    const errors = validateMCPServer(finalServer);
    if (errors.length > 0) {
      return;
    }

    onSave(finalServer, formData.scope === 'project' ? projectFolderPath : undefined);
  };

  const currentStep = WIZARD_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1;

  // Get visible steps (filter based on server type)
  const visibleSteps = WIZARD_STEPS.filter(step => {
    if (step.id === 'args' && formData.type !== 'stdio') return false;
    if (step.id === 'headers' && formData.type === 'stdio') return false;
    return true;
  });

  // Calculate the visible step index (position within visibleSteps)
  const visibleStepIndex = visibleSteps.findIndex(s => s.id === currentStep.id);

  // Calculate progress percentage based on completed steps, not current position
  const completedSteps = visibleSteps.filter(step => isStepComplete(step.id)).length;
  const progressPercentage = Math.round((completedSteps / visibleSteps.length) * 100);

  // Sidebar steps data
  const sidebarSteps = visibleSteps.map((step, index) => {
    const originalIndex = WIZARD_STEPS.findIndex(s => s.id === step.id);
    return {
      ...step,
      originalIndex,
      displayIndex: index,
      isActive: currentStep.id === step.id,
      isVisited: visitedSteps.has(originalIndex),
      isComplete: isStepComplete(step.id),
      canNavigate: canNavigateToStep(originalIndex),
    };
  });

  // Add/remove handlers for key-value editors
  const addHeaderEntry = () => setHeaderEntries(prev => [...prev, { key: '', value: '' }]);
  const removeHeaderEntry = (index: number) => setHeaderEntries(prev => prev.filter((_, i) => i !== index));
  const updateHeaderEntry = (index: number, field: 'key' | 'value', value: string) => {
    setHeaderEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  };

  const addEnvEntry = () => setEnvEntries(prev => [...prev, { key: '', value: '' }]);
  const removeEnvEntry = (index: number) => setEnvEntries(prev => prev.filter((_, i) => i !== index));
  const updateEnvEntry = (index: number, field: 'key' | 'value', value: string) => {
    setEnvEntries(prev => prev.map((entry, i) => i === index ? { ...entry, [field]: value } : entry));
  };

  const addArgEntry = () => setArgsEntries(prev => [...prev, '']);
  const removeArgEntry = (index: number) => setArgsEntries(prev => prev.filter((_, i) => i !== index));
  const updateArgEntry = (index: number, value: string) => {
    setArgsEntries(prev => prev.map((arg, i) => i === index ? value : arg));
  };

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
                  <ServerIcon className="h-5 w-5 text-v-accent" />
                  <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    Start from scratch
                  </span>
                </div>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                  Configure everything manually
                </p>
              </button>

              {MCP_SERVER_TEMPLATES.map(template => (
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
                    <ServerIcon className="h-5 w-5 text-v-accent" />
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

      case 'type':
        return (
          <div className="space-y-3">
            {SERVER_TYPE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => handleTypeChange(option.value)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  formData.type === option.value
                    ? 'border-v-accent bg-v-accent/10'
                    : 'border-v-light-border dark:border-v-border hover:border-v-accent/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-v-light-text-primary dark:text-v-text-primary">
                    {option.title}
                  </span>
                  {formData.type === option.value && (
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

      case 'config':
        return (
          <div className="space-y-6">
            <InputField
              id="server-name"
              label="Server name"
              value={formData.name}
              onChange={handleNameChange}
              placeholder="e.g., github, postgres, my-server"
              error={nameError}
              hint="Unique identifier for this server"
            />

            {formData.type === 'stdio' ? (
              <InputField
                id="server-command"
                label="Command"
                value={formData.command || ''}
                onChange={e => setFormData(prev => ({ ...prev, command: e.target.value }))}
                placeholder="e.g., npx -y @modelcontextprotocol/server-github"
                hint="The command to execute"
              />
            ) : (
              <InputField
                id="server-url"
                label="URL"
                value={formData.url || ''}
                onChange={e => setFormData(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://your-server.com/mcp"
                hint="Server endpoint URL"
              />
            )}
          </div>
        );

      case 'args':
        return (
          <div className="space-y-4">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Add command-line arguments that will be passed to the server process.
            </p>
            <div className="space-y-2">
              {argsEntries.map((arg, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={arg}
                    onChange={e => updateArgEntry(index, e.target.value)}
                    placeholder={`Argument ${index + 1}`}
                    className="flex-1 px-3 py-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-md text-sm text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-1 focus:ring-v-accent"
                  />
                  <button
                    type="button"
                    onClick={() => removeArgEntry(index)}
                    className="p-2 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-danger transition-colors"
                  >
                    <DeleteIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addArgEntry}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-v-accent hover:bg-v-accent/10 rounded-md transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add argument
            </button>
          </div>
        );

      case 'headers':
        return (
          <div className="space-y-4">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Add HTTP headers. Use {`\${VAR}`} syntax for environment variable references.
            </p>
            <div className="space-y-2">
              {headerEntries.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.key}
                    onChange={e => updateHeaderEntry(index, 'key', e.target.value)}
                    placeholder="Header name"
                    className="flex-1 px-3 py-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-md text-sm text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-1 focus:ring-v-accent"
                  />
                  <input
                    type="text"
                    value={entry.value}
                    onChange={e => updateHeaderEntry(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-md text-sm text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-1 focus:ring-v-accent"
                  />
                  <button
                    type="button"
                    onClick={() => removeHeaderEntry(index)}
                    className="p-2 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-danger transition-colors"
                  >
                    <DeleteIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addHeaderEntry}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-v-accent hover:bg-v-accent/10 rounded-md transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add header
            </button>
          </div>
        );

      case 'env':
        return (
          <div className="space-y-4">
            <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
              Define environment variables. Use {`\${VAR}`} or {`\${VAR:-default}`} for references.
            </p>
            <div className="space-y-2">
              {envEntries.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={entry.key}
                    onChange={e => updateEnvEntry(index, 'key', e.target.value)}
                    placeholder="Variable name"
                    className="flex-1 px-3 py-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-md text-sm font-mono text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-1 focus:ring-v-accent"
                  />
                  <input
                    type="text"
                    value={entry.value}
                    onChange={e => updateEnvEntry(index, 'value', e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-md text-sm font-mono text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-1 focus:ring-v-accent"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvEntry(index)}
                    className="p-2 text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-danger transition-colors"
                  >
                    <DeleteIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addEnvEntry}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-v-accent hover:bg-v-accent/10 rounded-md transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              Add environment variable
            </button>
          </div>
        );

      case 'scope':
        return (
          <div className="space-y-4">
            {(['user', 'project'] as MCPScope[]).map(scope => (
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

            {formData.scope === 'project' && (
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
                Server Configuration
              </h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Name</dt>
                  <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    {formData.name}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Type</dt>
                  <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary uppercase">
                    {formData.type}
                  </dd>
                </div>
                {formData.type === 'stdio' && formData.command && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Command</dt>
                    <dd className="text-sm font-mono text-v-light-text-primary dark:text-v-text-primary truncate max-w-xs">
                      {formData.command}
                    </dd>
                  </div>
                )}
                {(formData.type === 'http' || formData.type === 'sse') && formData.url && (
                  <div className="flex justify-between">
                    <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">URL</dt>
                    <dd className="text-sm font-mono text-v-light-text-primary dark:text-v-text-primary truncate max-w-xs">
                      {formData.url}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">Scope</dt>
                  <dd className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                    {SCOPE_DETAILS[formData.scope].title}
                  </dd>
                </div>
                {argsEntries.length > 0 && (
                  <div>
                    <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-1">Arguments</dt>
                    <dd className="text-sm font-mono text-v-light-text-primary dark:text-v-text-primary">
                      {argsEntries.filter(Boolean).join(' ')}
                    </dd>
                  </div>
                )}
                {headerEntries.length > 0 && (
                  <div>
                    <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-1">Headers</dt>
                    <dd className="text-sm font-mono text-v-light-text-primary dark:text-v-text-primary">
                      {headerEntries.filter(e => e.key).map(e => `${e.key}: ${e.value}`).join(', ')}
                    </dd>
                  </div>
                )}
                {envEntries.length > 0 && (
                  <div>
                    <dt className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mb-1">Environment</dt>
                    <dd className="text-sm font-mono text-v-light-text-primary dark:text-v-text-primary">
                      {envEntries.filter(e => e.key).map(e => `${e.key}=${e.value}`).join(', ')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const title = mode === 'create' ? 'New MCP Server' : `Edit ${server?.name}`;
  const saveLabel = mode === 'edit' ? 'Save Changes' : 'Create Server';

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
          <ServerIcon className="w-5 h-5 text-v-accent" />
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
              <p className="text-base font-semibold text-v-light-text-primary dark:text-v-text-primary">Server setup</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-v-light-text-secondary dark:text-v-text-secondary">Step {visibleStepIndex + 1} of {visibleSteps.length}</span>
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
                const isClickable = step.isActive || step.displayIndex < visibleStepIndex || step.canNavigate;
                return (
                  <button
                    type="button"
                    key={step.id}
                    onClick={() => isClickable && goToStep(step.originalIndex)}
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
                      {step.isComplete && step.isVisited ? <CheckIcon className="h-4 w-4" /> : step.displayIndex + 1}
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
            <WizardStepHeader currentStepIndex={visibleStepIndex} wizardSteps={visibleSteps} />
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
