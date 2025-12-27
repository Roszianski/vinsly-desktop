import React from 'react';
import { View } from '../../hooks/useNavigation';
import { useNavigationContext } from '../../contexts/NavigationContext';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface BreadcrumbProps {
  className?: string;
}

// Maps view types to human-readable labels
const VIEW_LABELS: Record<string, string> = {
  subagents: 'Agents',
  skills: 'Skills',
  team: 'Team',
  memory: 'Memory',
  commands: 'Commands',
  mcp: 'MCP Servers',
  hooks: 'Hooks',
  edit: 'Edit',
  create: 'Create',
  duplicate: 'Duplicate',
  'create-skill': 'Create',
  'edit-skill': 'Edit',
  'create-command': 'Create',
  'edit-command': 'Edit',
  'create-memory': 'Create',
  'edit-memory': 'Edit',
  'create-mcp': 'Create',
  'edit-mcp': 'Edit',
  'create-hook': 'Create',
  'edit-hook': 'Edit',
};

// Maps edit views to their parent list views
const PARENT_VIEWS: Record<string, string> = {
  edit: 'subagents',
  create: 'subagents',
  duplicate: 'subagents',
  'create-skill': 'skills',
  'edit-skill': 'skills',
  'create-command': 'commands',
  'edit-command': 'commands',
  'create-memory': 'memory',
  'edit-memory': 'memory',
  'create-mcp': 'mcp',
  'edit-mcp': 'mcp',
  'create-hook': 'hooks',
  'edit-hook': 'hooks',
};

/**
 * Breadcrumb navigation component
 * Shows the current location in the app hierarchy and allows navigation back to list views
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ className = '' }) => {
  const {
    currentView,
    selectedAgent,
    selectedSkill,
    selectedCommand,
    selectedMemory,
    selectedMCPServer,
    selectedHook,
    navigateToView,
    navigateHome,
  } = useNavigationContext();

  // Build breadcrumb items based on current view
  const buildBreadcrumbs = (): BreadcrumbItem[] => {
    const items: BreadcrumbItem[] = [];

    // Always add "Home" as first item
    items.push({
      label: 'Home',
      onClick: () => navigateHome(),
    });

    // Get parent view for edit/create views
    const parentView = PARENT_VIEWS[currentView];

    if (parentView) {
      // Add parent list view
      items.push({
        label: VIEW_LABELS[parentView] || parentView,
        onClick: () => navigateToView(parentView as 'subagents' | 'skills' | 'team' | 'memory' | 'commands' | 'mcp' | 'hooks'),
      });

      // Add current action (Edit/Create) with item name
      let itemName = '';
      if (currentView.includes('edit') || currentView === 'duplicate') {
        // Get the name of the item being edited
        if (selectedAgent) itemName = selectedAgent.name;
        else if (selectedSkill) itemName = selectedSkill.name;
        else if (selectedCommand) itemName = selectedCommand.name;
        else if (selectedMemory) itemName = selectedMemory.path.split('/').pop() || 'Memory';
        else if (selectedMCPServer) itemName = selectedMCPServer.name;
        else if (selectedHook) itemName = selectedHook.name || 'Hook';
      }

      const actionLabel = VIEW_LABELS[currentView] || 'Edit';
      items.push({
        label: itemName ? `${actionLabel}: ${itemName}` : actionLabel,
        isActive: true,
      });
    } else {
      // We're on a list view
      items.push({
        label: VIEW_LABELS[currentView] || currentView,
        isActive: true,
      });
    }

    return items;
  };

  const breadcrumbs = buildBreadcrumbs();

  // Don't show breadcrumbs if we're just on the home/main list view
  if (breadcrumbs.length <= 2 && !PARENT_VIEWS[currentView]) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-sm ${className}`}>
      {breadcrumbs.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <ChevronIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary flex-shrink-0" />
          )}
          {item.onClick && !item.isActive ? (
            <button
              onClick={item.onClick}
              className="text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent transition-colors truncate max-w-[120px]"
              title={item.label}
            >
              {item.label}
            </button>
          ) : (
            <span
              className={`truncate max-w-[200px] ${
                item.isActive
                  ? 'text-v-light-text-primary dark:text-v-text-primary font-medium'
                  : 'text-v-light-text-secondary dark:text-v-text-secondary'
              }`}
              title={item.label}
            >
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

const ChevronIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);
