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

  const goToStep = useCallback((nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= WIZARD_STEPS.length) return;
    setDirection(nextIndex > currentStepIndex ? 1 : -1);
    setCurrentStepIndex(nextIndex);
    setVisitedSteps(prev => new Set(prev).add(nextIndex));
  }, [currentStepIndex]);

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
                className={`p-4 rounded-lg border-2 text-left transition-all ${
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
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
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
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
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
                className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
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

  const breadcrumbLabel = mode === 'create' ? 'New Server' : `Edit: ${server?.name}`;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <button
          onClick={onCancel}
          className="text-sm font-semibold text-v-accent hover:text-v-accent-hover inline-flex items-center gap-2"
        >
          <span aria-hidden="true">←</span>
          Back to MCP servers
        </button>
        <div className="flex items-center gap-2 text-sm text-v-light-text-secondary dark:text-v-text-secondary">
          <span className="text-v-light-text-primary dark:text-v-text-primary">MCP Servers</span>
          <span>/</span>
          <span className="text-v-light-text-primary dark:text-v-text-primary">{breadcrumbLabel}</span>
        </div>
      </div>
      <div>
        <h1 className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary -ml-px">
          {mode === 'create' ? 'Add MCP Server' : `Edit ${server?.name}`}
        </h1>
        <p className="text-v-light-text-secondary dark:text-v-text-secondary mt-1">
          {mode === 'create' ? 'Configure a new MCP server connection.' : 'Update server configuration.'}
        </p>
      </div>

      {/* Progress Steps */}
      {isWizard && (
        <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-2">
          {WIZARD_STEPS.map((step, index) => {
            // Skip irrelevant steps in progress bar too
            if (step.id === 'args' && formData.type !== 'stdio') return null;
            if (step.id === 'headers' && formData.type === 'stdio') return null;

            return (
              <div
                key={step.id}
                className={`flex items-center gap-1 ${index > 0 ? 'ml-1' : ''}`}
              >
                {index > 0 && (
                  <div className={`w-8 h-0.5 ${
                    visitedSteps.has(index) ? 'bg-v-accent' : 'bg-v-light-border dark:bg-v-border'
                  }`} />
                )}
                <button
                  type="button"
                  onClick={() => visitedSteps.has(index) && goToStep(index)}
                  disabled={!visitedSteps.has(index)}
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                    currentStepIndex === index
                      ? 'bg-v-accent text-white'
                      : visitedSteps.has(index)
                        ? 'bg-v-accent/20 text-v-accent cursor-pointer hover:bg-v-accent/30'
                        : 'bg-v-light-border dark:bg-v-border text-v-light-text-secondary dark:text-v-text-secondary'
                  }`}
                >
                  {visitedSteps.has(index) && index < currentStepIndex ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Step Content */}
      <div className="flex-1 overflow-auto min-h-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={currentStep.id}
            variants={wizardStepVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            custom={direction}
            className="h-full"
          >
            <WizardStepHeader
              currentStepIndex={currentStepIndex}
              wizardSteps={WIZARD_STEPS}
            />
            <div className="mt-6 max-w-2xl">
              {renderStepContent()}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-v-light-border dark:border-v-border">
        <button
          type="button"
          onClick={currentStepIndex === 0 ? onCancel : handlePrevStep}
          className="px-4 py-2 text-sm font-medium text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors"
        >
          {currentStepIndex === 0 ? 'Cancel' : 'Back'}
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 bg-v-accent text-white text-sm font-semibold rounded-md hover:bg-v-accent-hover transition-colors shadow-sm hover:shadow-md"
          >
            {mode === 'create' ? 'Create Server' : 'Save Changes'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNextStep}
            className="px-6 py-2 bg-v-accent text-white text-sm font-semibold rounded-md hover:bg-v-accent-hover transition-colors shadow-sm hover:shadow-md"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
};
