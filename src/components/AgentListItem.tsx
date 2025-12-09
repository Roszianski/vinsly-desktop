import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Agent, AgentScope } from '../types';
import { EditIcon } from './icons/EditIcon';
import { DuplicateIcon } from './icons/DuplicateIcon';
import { FolderIcon } from './icons/FolderIcon';
import { DeleteIcon } from './icons/DeleteIcon';
import { listItem, iconButtonVariants } from '../animations';
import { StarIcon } from './icons/StarIcon';
import { SpinnerIcon } from './icons/SpinnerIcon';
import { ConfirmDialog } from './ConfirmDialog';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { useToast } from '../contexts/ToastContext';
import { resolveAgentPath } from '../utils/pathHelpers';
import { getToolsState } from '../utils/toolHelpers';
import { devLog } from '../utils/devLogger';

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

interface AgentListItemProps {
  agent: Agent;
  onEdit: (agent: Agent) => void;
  onDuplicate: (agent: Agent) => void;
  onDelete: (agentId: string) => void;
  isPreview?: boolean;
  isSelected: boolean;
  onSelect: (agentId: string, isSelected: boolean) => void;
  highlightTerm?: string;
  onToggleFavorite: (agent: Agent) => void;
  gridTemplateColumns?: string;
}

const colorMap: { [key: string]: string } = {
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  purple: 'bg-purple-500',
  orange: 'bg-orange-500',
  pink: 'bg-pink-500',
  cyan: 'bg-cyan-500',
};

export const AgentListItem: React.FC<AgentListItemProps> = ({
    agent,
    onEdit,
    onDuplicate,
    onDelete,
    isPreview = false,
    isSelected,
    onSelect,
    highlightTerm,
    onToggleFavorite,
    gridTemplateColumns
  }) => {
    const { showToast } = useToast();
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [menuPosition, setMenuPosition] = useState<'above' | 'below'>('below');
    const menuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuPortalRef = useRef<HTMLDivElement | null>(null);
    const [menuCoords, setMenuCoords] = useState<{ top: number; left: number } | null>(null);
    const [isRevealing, setIsRevealing] = useState(false);
    const isFavorite = Boolean(agent.isFavorite);
    const toolsState = getToolsState(agent.frontmatter.tools);
    const toolCount = toolsState.list.length;
    const toolsSummary = toolsState.inheritsAll
        ? 'All session tools'
        : toolsState.explicitNone
            ? 'No tools available'
            : `${toolCount} tool${toolCount === 1 ? '' : 's'}`;

    const colorIndicatorClass = agent.frontmatter.color ? colorMap[agent.frontmatter.color] || 'bg-v-accent' : 'bg-black dark:bg-white border border-v-light-border dark:border-v-border';
    const displayPath = agent.path || 'Path pending save';
    const simplifiedPath = displayPath
        .replace(/^\/Users\/([^/]+)/, '~')
        .replace(/^C:\\Users\\([^\\]+)/, '~');

    const normalizedHighlight = highlightTerm?.trim();
    const highlightText = (text: string) => {
        if (!normalizedHighlight) {
            return text;
        }
        const escaped = escapeRegExp(normalizedHighlight);
        if (!escaped) {
            return text;
        }
        const regex = new RegExp(`(${escaped})`, 'gi');
        const parts = text.split(regex);
        if (parts.length <= 1) {
            return text;
        }
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

    const handleDelete = () => {
        if (isPreview) return;
        setShowActionMenu(false);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (agent.id) {
            onDelete(agent.id);
        }
        setShowDeleteConfirm(false);
    };

    const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (agent.id) {
            onSelect(agent.id, e.target.checked);
        }
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const anchor = menuRef.current;
            const menuEl = menuPortalRef.current;
            if (anchor?.contains(target) || menuEl?.contains(target)) {
                return;
            }
            setShowActionMenu(false);
            setMenuCoords(null);
        };

        if (showActionMenu && typeof document !== 'undefined') {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            if (typeof document !== 'undefined') {
                document.removeEventListener('mousedown', handleClickOutside);
            }
        };
    }, [showActionMenu]);

    // Compute menu position when opened
    useEffect(() => {
        if (!showActionMenu || !buttonRef.current || typeof window === 'undefined') {
            return;
        }

        const buttonRect = buttonRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const menuHeight = 200; // Approximate menu height
        const menuWidth = 192; // w-48
        const spaceBelow = viewportHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;

        let desiredPosition: 'above' | 'below' = 'below';
        if (spaceBelow >= menuHeight) {
            desiredPosition = 'below';
        } else if (spaceAbove >= menuHeight) {
            desiredPosition = 'above';
        } else {
            desiredPosition = spaceBelow >= spaceAbove ? 'below' : 'above';
        }
        setMenuPosition(desiredPosition);

        const padding = 8;
        let top =
            desiredPosition === 'below'
                ? buttonRect.bottom + 8
                : buttonRect.top - menuHeight - 8;
        let left = buttonRect.right - menuWidth;

        if (left < padding) left = padding;
        if (left + menuWidth > viewportWidth - padding) {
            left = viewportWidth - padding - menuWidth;
        }
        if (top < padding) top = padding;

        setMenuCoords({ top, left });
    }, [showActionMenu]);

    const handleMenuAction = (action: () => void) => {
        action();
        setShowActionMenu(false);
    };

    const handleMenuToggle = () => {
        if (showActionMenu) {
            setShowActionMenu(false);
            setMenuCoords(null);
            return;
        }
        setShowActionMenu(true);
    };

    const handleReveal = async () => {
        if (isRevealing) return;
        setIsRevealing(true);
        try {
            const resolvedPath = await resolveAgentPath(agent.path);
            if (!resolvedPath) {
                showToast('error', 'Unable to locate this agent on disk yet.');
                return;
            }
            await revealItemInDir(resolvedPath);
        } catch (error) {
            devLog.error('Error revealing file:', error);
            showToast('error', 'Failed to reveal the agent in your file manager.');
        } finally {
            setIsRevealing(false);
        }
    };

    return (
        <motion.div

            variants={listItem}
            initial="hidden"
            animate="visible"
            className={`grid gap-4 items-center px-4 py-3 hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors duration-200 ${isSelected ? 'bg-v-accent/10' : 'bg-v-light-surface dark:bg-v-mid-dark'}`}
            style={gridTemplateColumns ? { gridTemplateColumns } : undefined}
        >
            <div className="flex justify-center">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={handleSelectChange}
                    aria-label={`Select agent ${agent.name}`}
                    disabled={!agent.id}
                    className="h-4 w-4 bg-v-light-surface dark:bg-v-mid-dark border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent rounded"
                />
            </div>
            <div className="pr-2">
                <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 rounded-full ${colorIndicatorClass}`} title={agent.frontmatter.color ? `Colour: ${agent.frontmatter.color}` : 'Automatic colour'} aria-hidden="true"></span>
                    <div className="flex items-center gap-1.5">
                        <p className="font-mono text-sm text-v-light-text-primary dark:text-v-text-primary">
                            {agent.name
                                ? highlightText(agent.name)
                                : <span className="italic text-v-text-secondary">agent-name</span>}
                        </p>
                    </div>
                </div>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary truncate">
                    {agent.frontmatter.description
                        ? highlightText(agent.frontmatter.description)
                        : <span className="italic">Agent description...</span>}
                </p>
            </div>
            <div className="relative group">
                <span className="text-xs font-mono text-v-light-text-secondary dark:text-v-text-secondary truncate block max-w-full">
                    {simplifiedPath}
                </span>
                <span className="pointer-events-none absolute -top-8 left-0 z-10 hidden group-hover:block bg-black text-white text-[11px] px-2 py-1 rounded shadow-lg whitespace-nowrap">
                    {displayPath}
                </span>
            </div>
            <div>
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${agent.scope === AgentScope.Project ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300'}`}>
                    {agent.scope}
                </span>
            </div>
            <div>
                <span className="font-mono text-sm text-v-light-text-secondary dark:text-v-text-secondary">{agent.frontmatter.model || 'default (sonnet)'}</span>
            </div>
            <div>
                <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary truncate">{toolsSummary}</p>
            </div>
            <div className="flex justify-end items-center gap-3">
                <button
                    type="button"
                    onClick={() => !isPreview && onToggleFavorite(agent)}
                    aria-label={isFavorite ? 'Unpin agent' : 'Pin agent'}
                    disabled={isPreview}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v-accent/60 ${
                        isPreview
                            ? 'opacity-40 cursor-not-allowed border-transparent'
                            : isFavorite
                                ? 'border-v-accent text-v-accent bg-v-accent/10 hover:bg-v-accent/15'
                                : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary bg-white/80 dark:bg-white/5 hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                    }`}
                >
                    <StarIcon className="h-4 w-4" filled={isFavorite} />
                </button>

                {isRevealing && (
                    <div className="flex items-center gap-1 text-[11px] text-v-light-text-secondary dark:text-v-text-secondary">
                        <SpinnerIcon className="h-3 w-3 text-v-light-text-secondary dark:text-v-text-secondary" />
                        <span>Opening…</span>
                    </div>
                )}

                {/* Actions Menu */}
                <div className="relative" ref={menuRef}>
                    <motion.button
                        ref={buttonRef}
                        type="button"
                        onClick={() => !isPreview && handleMenuToggle()}
                        aria-label="More actions"
                        disabled={isPreview}
                        variants={iconButtonVariants}
                        initial="rest"
                        whileHover={!isPreview ? "hover" : "rest"}
                        whileTap={!isPreview ? "tap" : "rest"}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-v-accent/60 ${
                            isPreview
                                ? 'opacity-40 cursor-not-allowed border-transparent'
                                : 'shadow-sm border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary bg-white/80 dark:bg-white/5 hover:bg-v-light-hover dark:hover:bg-v-light-dark'
                        }`}
                    >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                        </svg>
                    </motion.button>

                    {showActionMenu && menuCoords && typeof document !== 'undefined' &&
                        createPortal(
                            <motion.div
                                ref={menuPortalRef}
                                initial={{ opacity: 0, y: menuPosition === 'below' ? -10 : 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: menuPosition === 'below' ? -10 : 10, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                style={{
                                    position: 'fixed',
                                    top: menuCoords.top,
                                    left: menuCoords.left,
                                    zIndex: 1000
                                }}
                                className="w-48 bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-lg shadow-lg overflow-hidden"
                            >
                                <button
                                    onClick={() => handleMenuAction(() => onEdit(agent))}
                                    className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3"
                                >
                                    <EditIcon className="h-4 w-4" />
                                    <span>Edit</span>
                                </button>
                                <button
                                    onClick={() => handleMenuAction(() => onDuplicate(agent))}
                                    className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3"
                                >
                                    <DuplicateIcon className="h-4 w-4" />
                                    <span>Clone</span>
                                </button>
                                <button
                                    onClick={() => handleMenuAction(handleReveal)}
                                    className="w-full px-4 py-2.5 text-left text-sm text-v-light-text-primary dark:text-v-text-primary hover:bg-v-light-hover dark:hover:bg-v-light-dark transition-colors flex items-center gap-3 disabled:opacity-60"
                                    disabled={isRevealing}
                                >
                                    {isRevealing ? (
                                        <>
                                            <SpinnerIcon className="h-4 w-4 text-v-light-text-secondary dark:text-v-text-secondary" />
                                            <span>Opening…</span>
                                        </>
                                    ) : (
                                        <>
                                            <FolderIcon className="h-4 w-4" />
                                            <span>Reveal in Folder</span>
                                        </>
                                    )}
                                </button>
                                <div className="border-t border-v-light-border dark:border-v-border"></div>
                                <button
                                    onClick={() => handleMenuAction(handleDelete)}
                                    className="w-full px-4 py-2.5 text-left text-sm text-v-danger hover:bg-v-danger/10 transition-colors flex items-center gap-3"
                                >
                                    <DeleteIcon className="h-4 w-4" />
                                    <span>Delete</span>
                                </button>
                            </motion.div>,
                            document.body
                        )}
                </div>
            </div>

            <ConfirmDialog
                isOpen={showDeleteConfirm}
                title="Delete Agent"
                message={`Are you sure you want to delete agent "${agent.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                variant="danger"
            />
        </motion.div>
    );
};
