import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Skill, AgentScope } from '../../types';
import { PlusIcon } from '../icons/PlusIcon';
import { SearchIcon } from '../icons/SearchIcon';
import { UploadIcon } from '../icons/UploadIcon';
import { DownloadIcon } from '../icons/DownloadIcon';
import { ListIcon } from '../icons/ListIcon';
import { GridIcon } from '../icons/GridIcon';
import { LayersIcon } from '../icons/LayersIcon';
import { NetworkIcon } from '../icons/NetworkIcon';
import { ChartIcon } from '../icons/ChartIcon';
import { SpinnerIcon } from '../icons/SpinnerIcon';
import { DeleteIcon } from '../icons/DeleteIcon';
import { FolderIcon } from '../icons/FolderIcon';
import { GlobeIcon } from '../icons/GlobeIcon';
import { EditIcon } from '../icons/EditIcon';
import { StarIcon } from '../icons/StarIcon';
import { ConfirmDialog } from '../ConfirmDialog';
import { getStorageItem, setStorageItem } from '../../utils/storage';
import { fuzzyMatch } from '../../utils/fuzzyMatch';
import { useToast } from '../../contexts/ToastContext';

type LayoutMode = 'table' | 'grid';
type Filter = 'All' | AgentScope;

const LAYOUT_STORAGE_KEY = 'vinsly-skill-list-layout';
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlightText = (text: string, term?: string) => {
  if (!term?.trim()) return text;
  const escaped = escapeRegExp(term.trim());
  if (!escaped) return text;
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={`${part}-${index}`}
        className="bg-yellow-200 dark:bg-yellow-700 text-v-dark dark:text-white rounded px-0.5"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
};

interface SkillListScreenProps {
  skills: Skill[];
  onCreateSkill: () => void;
  onEditSkill: (skill: Skill) => void;
  onDeleteSkill: (skillId: string) => void;
  onRevealSkill: (skill: Skill) => void;
  onExportSkill: (skill: Skill) => void;
  onExportSkills: (skills: Skill[]) => Promise<void>;
  onImportSkill: () => Promise<void>;
  onShowSubagents: () => void;
  onShowSkills: () => void;
  onShowTeam: () => void;
  onShowAnalytics: () => void;
  activeView: 'subagents' | 'skills' | 'team' | 'analytics';
  onToggleFavorite: (skill: Skill) => void;
}

export const SkillListScreen: React.FC<SkillListScreenProps> = ({
  skills,
  onCreateSkill,
  onEditSkill,
  onDeleteSkill,
  onRevealSkill,
  onExportSkill,
  onExportSkills,
  onImportSkill,
  onShowSubagents,
  onShowSkills,
  onShowTeam,
  onShowAnalytics,
  activeView,
  onToggleFavorite,
}) => {
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('table');
  const [layoutLoaded, setLayoutLoaded] = useState(false);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadLayout = async () => {
      const stored = await getStorageItem<LayoutMode>(LAYOUT_STORAGE_KEY);
      if (stored === 'grid' || stored === 'table') {
        setLayoutMode(stored);
      }
      setLayoutLoaded(true);
    };
    loadLayout();
  }, []);

  useEffect(() => {
    if (!layoutLoaded) return;
    setStorageItem(LAYOUT_STORAGE_KEY, layoutMode);
  }, [layoutMode, layoutLoaded]);

  useEffect(() => {
    setSelectedSkillIds(new Set());
  }, [searchQuery, filter, layoutMode]);

  const { totalSkills, projectSkills, globalSkills } = useMemo(() => {
    const projectCount = skills.filter(skill => skill.scope === AgentScope.Project).length;
    const globalCount = skills.filter(skill => skill.scope === AgentScope.Global).length;
    return {
      totalSkills: skills.length,
      projectSkills: projectCount,
      globalSkills: globalCount,
    };
  }, [skills]);

  const filteredSkills = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return skills.filter(skill => {
      const scopeMatch = filter === 'All' || skill.scope === filter;
      if (!scopeMatch) return false;

      if (!normalizedQuery) return true;

      const description = `${skill.frontmatter.description || ''}`;
      return (
        fuzzyMatch(skill.name, normalizedQuery) ||
        description.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [skills, filter, searchQuery]);

  const areAllSelected = filteredSkills.length > 0 && selectedSkillIds.size === filteredSkills.length;
  const isIndeterminate = selectedSkillIds.size > 0 && !areAllSelected;

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  const handleSelectSkill = (skillId: string, isSelected: boolean) => {
    setSelectedSkillIds(prev => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(skillId);
      } else {
        next.delete(skillId);
      }
      return next;
    });
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedSkillIds(new Set(filteredSkills.map(skill => skill.id)));
    } else {
      setSelectedSkillIds(new Set());
    }
  };

  const handleImportClick = async () => {
    if (isImporting) return;
    setIsImporting(true);
    try {
      await onImportSkill();
    } finally {
      setIsImporting(false);
    }
  };

  const handleExportAll = async () => {
    if (filteredSkills.length === 0) return;
    await onExportSkills(filteredSkills);
  };

  const handleExportSelected = async () => {
    if (selectedSkillIds.size === 0) return;
    const batch = filteredSkills.filter(skill => selectedSkillIds.has(skill.id));
    await onExportSkills(batch);
    showToast('success', `Exported ${batch.length} skill(s)`);
  };

  const handleBulkDelete = () => {
    if (selectedSkillIds.size === 0) return;
    setShowDeleteConfirm(true);
  };

  const confirmBulkDelete = () => {
    selectedSkillIds.forEach(id => onDeleteSkill(id));
    setSelectedSkillIds(new Set());
    setShowDeleteConfirm(false);
  };

  const renderViewSwitcher = () => (
    <div
      className="flex items-stretch border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark"
      data-tour="skill-view-switcher"
    >
      {[
        { key: 'subagents', label: 'Subagents', icon: <ListIcon className="h-4 w-4" />, action: onShowSubagents },
        { key: 'skills', label: 'Skills', icon: <LayersIcon className="h-4 w-4" />, action: onShowSkills },
        { key: 'team', label: 'Network', icon: <NetworkIcon className="h-4 w-4" />, action: onShowTeam },
        { key: 'analytics', label: 'Analytics', icon: <ChartIcon className="h-4 w-4" />, action: onShowAnalytics },
      ].map((item, index, array) => (
        <React.Fragment key={item.key}>
          <button
            onClick={item.action}
            className={`px-3 py-2 text-sm font-medium transition-colors duration-200 flex items-center gap-1.5 ${
              activeView === item.key
                ? 'bg-v-accent/10 text-v-accent'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary hover:bg-v-accent/10 dark:hover:bg-v-light-dark'
            }`}
          >
            {item.icon}
            <span className="hidden sm:inline">{item.label}</span>
          </button>
          {index < array.length - 1 && (
            <div className="w-px bg-v-light-border dark:bg-v-border opacity-50" />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center justify-between gap-3" data-tour="skill-toolbar">
      {selectedSkillIds.size > 0 ? (
        <div className="flex-grow flex items-center gap-4">
          <span className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
            {selectedSkillIds.size} selected
          </span>
          <button
            onClick={handleExportSelected}
            className="flex items-center gap-2 px-3 py-1.5 bg-v-accent hover:bg-v-accent-hover text-white font-semibold text-sm transition-transform duration-150 rounded-md shadow-sm hover:shadow-md active:scale-95"
          >
            <DownloadIcon className="h-4 w-4" />
            Export Selected
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 px-3 py-1.5 bg-v-danger hover:opacity-90 text-white font-semibold text-sm transition-transform duration-150 rounded-md shadow-sm hover:shadow-md active:scale-95"
          >
            <DeleteIcon className="h-4 w-4" />
            Delete Selected
          </button>
        </div>
      ) : (
        <>
          <div className="flex-grow flex items-center gap-4">
            <div className="relative flex-grow max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
              </div>
              <input
                type="text"
                placeholder="Search skills..."
                value={searchQuery}
                onChange={event => setSearchQuery(event.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary focus:border-v-accent focus:ring-2 focus:ring-v-accent focus:ring-offset-1 focus:ring-offset-v-light-surface dark:focus:ring-offset-v-mid-dark focus-visible:outline-none text-sm rounded-md"
              />
            </div>
            <div className="flex items-center border border-v-light-border dark:border-v-border rounded-md overflow-hidden">
              {(['All', AgentScope.Global, AgentScope.Project] as Filter[]).map(value => (
                <button
                  key={value}
                  onClick={() => setFilter(value)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    filter === value
                      ? 'bg-v-accent text-white'
                      : 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
                  }`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary border border-v-light-border dark:border-v-border rounded-md hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <SpinnerIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
                  <span>Importing…</span>
                </>
              ) : (
                <>
                  <UploadIcon className="h-4 w-4" />
                  <span>Import</span>
                </>
              )}
            </button>
            <button
              onClick={handleExportAll}
              disabled={filteredSkills.length === 0}
              className="inline-flex h-10 items-center gap-2 px-3 text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary border border-v-light-border dark:border-v-border rounded-md hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <DownloadIcon className="h-4 w-4" />
              <span>Export All</span>
            </button>
            <button
              onClick={onCreateSkill}
              className="inline-flex h-10 items-center gap-3 px-4 bg-v-accent text-white font-semibold text-sm transition-all duration-200 ease-out flex-shrink-0 rounded-md shadow-sm hover:shadow-lg transform hover:-translate-y-0.5 active:scale-95"
              data-tour="create-skill"
            >
              <PlusIcon className="h-4 w-4" />
              <span>New Skill</span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderGrid = () => (
    <div className="space-y-2">
      <div
        className="hidden md:grid gap-4 px-4 py-2 border-b border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary text-[11px] uppercase font-bold tracking-[0.2em] items-center"
        style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,2fr) minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr)' }}
      >
        <span>Name</span>
        <span>Description</span>
        <span>Scope</span>
        <span>Tools</span>
        <span className="text-right pr-1.5">Actions</span>
      </div>
      <div className="md:hidden px-4 py-2 border-b border-v-light-border dark:border-v-border text-[11px] uppercase tracking-[0.25em] text-v-light-text-secondary dark:text-v-text-secondary">
        Name • Description • Scope • Tools • Actions
      </div>
      <div className="p-4">
        {filteredSkills.length === 0 ? (
          <div className="text-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
            No skills found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSkills.map(skill => (
              <SkillGridCard
                key={skill.id}
                skill={skill}
                isSelected={selectedSkillIds.has(skill.id)}
                onSelect={(checked: boolean) => handleSelectSkill(skill.id, checked)}
                onEdit={() => onEditSkill(skill)}
                onExport={() => onExportSkill(skill)}
                onReveal={() => onRevealSkill(skill)}
                onDelete={() => onDeleteSkill(skill.id)}
                onToggleFavorite={() => onToggleFavorite(skill)}
                highlightTerm={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTable = () => (
    <div className="divide-y divide-v-light-border dark:divide-v-border">
      <div
        className="grid gap-4 px-4 py-2 border-b border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary text-xs uppercase font-bold tracking-wider items-center"
        style={{ gridTemplateColumns: '60px minmax(0,2.2fr) minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.6fr) 140px' }}
      >
        <div className="flex justify-center">
          <input
            ref={selectAllCheckboxRef}
            type="checkbox"
            checked={areAllSelected}
            onChange={handleSelectAll}
            disabled={filteredSkills.length === 0}
            aria-label="Select all skills"
            className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded"
          />
        </div>
        <span>Name</span>
        <span>Path</span>
        <span>Scope</span>
        <span>Tools</span>
        <span className="text-right pr-2">Actions</span>
      </div>
      {filteredSkills.length > 0 ? (
        <div>
          {filteredSkills.map(skill => (
            <SkillListRow
              key={skill.id}
              skill={skill}
              isSelected={selectedSkillIds.has(skill.id)}
              onSelect={handleSelectSkill}
              onEdit={onEditSkill}
              onExport={onExportSkill}
              onReveal={onRevealSkill}
              onDelete={onDeleteSkill}
              onToggleFavorite={onToggleFavorite}
              highlightTerm={searchQuery}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-v-light-text-secondary dark:text-v-text-secondary">
          No skills found.
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total skills', value: totalSkills, icon: LayersIcon },
          { label: 'Global skills', value: globalSkills, icon: GlobeIcon },
          { label: 'Project skills', value: projectSkills, icon: FolderIcon },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border px-4 py-3.5 shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-3 group hover:border-v-accent/30 transform hover:-translate-y-0.5"
            >
              <div className="flex-shrink-0 p-2 rounded-lg bg-v-accent/10 group-hover:bg-v-accent/20 transition-colors">
                <Icon className="h-5 w-5 text-v-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-v-light-text-secondary dark:text-v-text-secondary font-medium">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold text-v-light-text-primary dark:text-v-text-primary mt-0.5 tabular-nums">
                  {stat.value}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {renderViewSwitcher()}
        <div
          className="flex items-center gap-1 border border-v-light-border dark:border-v-border rounded-lg overflow-hidden bg-v-light-bg dark:bg-v-dark text-sm font-medium"
          data-tour="skill-layout"
        >
          <button
            type="button"
            onClick={() => setLayoutMode('table')}
            className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
              layoutMode === 'table'
                ? 'bg-v-accent/10 text-v-accent'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
            }`}
            aria-pressed={layoutMode === 'table'}
            title="Row layout"
          >
            <ListIcon className="h-4 w-4" />
            <span>Rows</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('grid')}
            className={`px-3 py-1.5 flex items-center gap-1 transition-colors ${
              layoutMode === 'grid'
                ? 'bg-v-accent/10 text-v-accent'
                : 'text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary'
            }`}
            aria-pressed={layoutMode === 'grid'}
            title="Card layout"
          >
            <GridIcon className="h-4 w-4" />
            <span>Cards</span>
          </button>
        </div>
      </div>

      {renderToolbar()}

      <div
        className="bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg overflow-hidden"
        data-tour="skill-list"
      >
        {layoutMode === 'grid' ? renderGrid() : renderTable()}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Skills"
        message={`Are you sure you want to delete ${selectedSkillIds.size} selected skill(s)? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        variant="danger"
      />
    </div>
  );
};

interface SkillGridCardProps {
  skill: Skill;
  isSelected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onExport: () => void;
  onReveal: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  highlightTerm?: string;
}

const SkillGridCard: React.FC<SkillGridCardProps> = ({
  skill,
  isSelected,
  onSelect,
  onEdit,
  onExport,
  onReveal,
  onDelete,
  onToggleFavorite,
  highlightTerm,
}) => {
  const allowedSummary = Array.isArray(skill.frontmatter.allowedTools)
    ? skill.frontmatter.allowedTools.join(', ')
    : typeof skill.frontmatter.allowedTools === 'string'
      ? skill.frontmatter.allowedTools
      : 'Inherits session tools';
  const fullPath = skill.path || skill.directoryPath || 'Path pending save';
  const ScopeIcon = skill.scope === AgentScope.Project ? FolderIcon : GlobeIcon;

  const ActionIconButton: React.FC<{
    onClick: () => void;
    title: string;
    children: React.ReactNode;
    ariaLabel?: string;
  }> = ({ onClick, title, children, ariaLabel }) => (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel || title}
      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent hover:text-v-accent transition-colors"
    >
      {children}
    </button>
  );

  return (
    <div className="rounded-2xl border border-v-light-border/80 dark:border-v-border/70 bg-v-light-surface dark:bg-v-mid-dark/90 p-4 shadow-[0_6px_20px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-v-accent/60 transition-all duration-200 flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={event => onSelect(event.target.checked)}
          aria-label={`Select ${skill.name}`}
          className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded mt-1"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="min-w-0">
              <p className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary truncate" title={skill.name}>
                {highlightText(skill.name, highlightTerm)}
              </p>
              <p className="text-[11px] font-mono text-v-light-text-secondary dark:text-v-text-secondary truncate" title={fullPath}>
                {fullPath}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                skill.scope === AgentScope.Project
                  ? 'bg-v-light-hover dark:bg-v-light-dark text-v-light-text-primary dark:text-v-text-primary'
                  : 'bg-v-accent/10 text-v-accent'
              }`}
            >
              <ScopeIcon className="h-3.5 w-3.5" />
              {skill.scope === AgentScope.Project ? 'Project' : 'Global'}
            </span>
            <button
              onClick={onToggleFavorite}
              className={`inline-flex items-center justify-center h-7 w-7 rounded-md border transition-colors ${
                skill.isFavorite
                  ? 'border-v-accent text-v-accent bg-v-accent/10 hover:bg-v-accent/20'
                  : 'border-transparent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent'
              }`}
              title={skill.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              aria-label={skill.isFavorite ? 'Unpin skill' : 'Pin skill'}
            >
              <StarIcon className="h-4 w-4" filled={Boolean(skill.isFavorite)} />
            </button>
          </div>
          <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1 truncate">
            {highlightText(skill.frontmatter.description || 'No description provided.', highlightTerm)}
          </p>
        </div>
      </div>
      <div className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary line-clamp-3">
        Allowed tools: {allowedSummary}
      </div>
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-dashed border-v-light-border/70 dark:border-v-border/70">
        <div className="flex items-center gap-2 flex-nowrap">
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-v-light-border dark:border-v-border text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent whitespace-nowrap"
          >
            <EditIcon className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent whitespace-nowrap"
          >
            <DownloadIcon className="h-3.5 w-3.5" />
            Export
          </button>
          <ActionIconButton onClick={onReveal} title="Reveal in Finder">
            <FolderIcon className="h-4 w-4" />
          </ActionIconButton>
          <ActionIconButton onClick={onDelete} title="Delete skill" ariaLabel={`Delete ${skill.name}`}>
            <DeleteIcon className="h-4 w-4 text-v-danger" />
          </ActionIconButton>
        </div>
      </div>
    </div>
  );
};

interface SkillListRowProps {
  skill: Skill;
  isSelected: boolean;
  onSelect: (skillId: string, checked: boolean) => void;
  onEdit: (skill: Skill) => void;
  onExport: (skill: Skill) => void;
  onReveal: (skill: Skill) => void;
  onDelete: (skillId: string) => void;
  onToggleFavorite: (skill: Skill) => void;
  highlightTerm?: string;
}

const SkillListRow: React.FC<SkillListRowProps> = ({
  skill,
  isSelected,
  onSelect,
  onEdit,
  onExport,
  onReveal,
  onDelete,
  onToggleFavorite,
  highlightTerm,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const fullPath = skill.path || skill.directoryPath || 'Path pending save';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setShowMenu(false);
    };
    if (showMenu && typeof document !== 'undefined') {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('mousedown', handleClickOutside);
      }
    };
  }, [showMenu]);

  const allowedSummary = Array.isArray(skill.frontmatter.allowedTools)
    ? skill.frontmatter.allowedTools.join(', ')
    : typeof skill.frontmatter.allowedTools === 'string'
      ? skill.frontmatter.allowedTools
      : 'Inherits session tools';

  const scopePillClasses =
    skill.scope === AgentScope.Project
      ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300'
      : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300';

  const handleDelete = () => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete(skill.id);
  };

  return (
    <div
      className="grid gap-4 px-4 py-3 items-center text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover/50 dark:hover:bg-v-light-dark/40 transition-colors"
      style={{ gridTemplateColumns: '60px minmax(0,2.2fr) minmax(0,2fr) minmax(0,1.2fr) minmax(0,1.6fr) 140px' }}
    >
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={event => onSelect(skill.id, event.target.checked)}
          aria-label={`Select ${skill.name}`}
          className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded"
        />
      </div>
      <div className="pr-2 space-y-0.5 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="min-w-0">
            <p className="font-semibold text-v-light-text-primary dark:text-v-text-primary truncate">
              {highlightText(skill.name, highlightTerm)}
            </p>
            <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary truncate">
              {highlightText(skill.frontmatter.description || '—', highlightTerm)}
            </p>
          </div>
          <button
            onClick={() => onToggleFavorite(skill)}
            className={`inline-flex items-center justify-center h-6 w-6 rounded-md border transition-colors ${
              skill.isFavorite
                ? 'border-v-accent text-v-accent bg-v-accent/10 hover:bg-v-accent/20'
                : 'border-transparent text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-accent'
            }`}
            title={skill.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-label={skill.isFavorite ? 'Unpin skill' : 'Pin skill'}
          >
            <StarIcon className="h-3.5 w-3.5" filled={Boolean(skill.isFavorite)} />
          </button>
        </div>
      </div>
      <div className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary truncate" title={fullPath}>
        {fullPath}
      </div>
      <div>
        <span className={`px-2 py-0.5 text-xs font-medium rounded ${scopePillClasses}`}>
          {skill.scope}
        </span>
      </div>
      <div className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary line-clamp-2">
        {allowedSummary}
      </div>
      <div className="flex justify-end items-center gap-2 relative">
        <button
          onClick={() => onReveal(skill)}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent"
          title="Reveal in Finder"
        >
          <FolderIcon className="h-4 w-4" />
        </button>
        <button
          ref={menuButtonRef}
          onClick={() => setShowMenu(prev => !prev)}
          aria-label="More actions"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary bg-white/80 dark:bg-white/5 hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
        {showMenu && (
          <div
            ref={menuRef}
            className="absolute right-0 top-10 z-20 w-48 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg shadow-lg overflow-hidden"
          >
            <button
              onClick={() => {
                setShowMenu(false);
                onEdit(skill);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3"
            >
              <EditIcon className="h-4 w-4" />
              <span>Edit</span>
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onExport(skill);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3"
            >
              <DownloadIcon className="h-4 w-4" />
              <span>Export</span>
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onReveal(skill);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3"
            >
              <FolderIcon className="h-4 w-4" />
              <span>Reveal</span>
            </button>
            <button
              onClick={handleDelete}
              className="w-full px-4 py-2.5 text-left text-sm text-v-danger hover:bg-v-danger/10 transition-colors flex items-center gap-3"
            >
              <DeleteIcon className="h-4 w-4" />
              <span>Delete</span>
            </button>
          </div>
        )}
        <ConfirmDialog
          isOpen={showDeleteConfirm}
          title="Delete Skill"
          message={`Are you sure you want to delete "${skill.name}"? This action cannot be undone.`}
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
          variant="danger"
        />
      </div>
    </div>
  );
};
