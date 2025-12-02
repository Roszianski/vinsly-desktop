/**
 * Hooks barrel file
 * Central export point for all custom React hooks
 */

// Resource list management
export { useResourceListState, createScopeFilter, createNameSorter } from './useResourceListState';
export type { ResourceListStateConfig, ResourceListStateResult } from './useResourceListState';

// Wizard navigation
export { useWizardNavigation } from './useWizardNavigation';
export type { WizardStep, UseWizardNavigationOptions, WizardNavigationState, SidebarStep } from './useWizardNavigation';

// Scope selection
export { useScopeSelection } from './useScopeSelection';
export type { UseScopeSelectionOptions, ScopeSelectionState } from './useScopeSelection';

// Name validation
export {
  useNameValidation,
  useAgentNameValidation,
  useSkillNameValidation,
  useCommandNameValidation,
} from './useNameValidation';
export type { NameValidationOptions, NameValidationResult } from './useNameValidation';

// Cache management
export { useCacheManager, useWorkspaceCache, useSessionCache } from './useCacheManager';
export type { CacheConfig, CacheManager } from './useCacheManager';

// Agent handlers
export { useAgentHandlers } from './useAgentHandlers';
export type { UseAgentHandlersOptions, UseAgentHandlersResult } from './useAgentHandlers';

// Skill handlers
export { useSkillHandlers } from './useSkillHandlers';
export type { UseSkillHandlersOptions, UseSkillHandlersResult } from './useSkillHandlers';
