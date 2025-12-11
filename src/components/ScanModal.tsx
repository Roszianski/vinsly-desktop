import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { useToast } from '../contexts/ToastContext';
import { cancelHomeDiscovery, DEFAULT_HOME_DISCOVERY_DEPTH, discoverHomeDirectories } from '../utils/homeDiscovery';
import { LoadAgentsOptions, ScanSettings, DetailedScanResult } from '../types';
import { devLog } from '../utils/devLogger';
import { checkFullDiskAccess, scanDirectoryForProjects } from '../utils/tauriCommands';

type ScanSource = 'home' | 'watched';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (options?: LoadAgentsOptions) => Promise<DetailedScanResult>;
  scanSettings: ScanSettings;
  isMacPlatform?: boolean;
}

interface SourceChipProps {
  label: string;
  description: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const SourceChip: React.FC<SourceChipProps> = ({ label, description, active, disabled, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={`px-4 py-3 rounded-xl border transition-colors text-left ${
      active
        ? 'border-v-accent bg-v-accent/10 text-v-light-text-primary dark:text-v-text-primary'
        : 'border-v-light-border dark:border-v-border bg-v-light-bg/60 dark:bg-v-dark/60 text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs mt-1 leading-snug">{description}</p>
      </div>
      <span
        className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
          active
            ? 'border-v-accent bg-v-accent text-white'
            : 'border-v-light-border dark:border-v-border bg-transparent text-transparent'
        }`}
        aria-hidden="true"
      >
        {active && (
          <svg className="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10.5l3 3 7-7" />
          </svg>
        )}
      </span>
    </div>
  </button>
);

export const ScanModal: React.FC<ScanModalProps> = ({
  isOpen,
  onClose,
  onScan,
  scanSettings,
  isMacPlatform = false,
}) => {
  const { showToast } = useToast();
  const [selectedSources, setSelectedSources] = useState<Set<ScanSource>>(new Set());
  const [includeGlobalResources, setIncludeGlobalResources] = useState(false);
  const [customPaths, setCustomPaths] = useState<string[]>([]);
  // Track which custom paths should scan subfolders (default: all recursive)
  const [recursivePaths, setRecursivePaths] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscoveringHome, setIsDiscoveringHome] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<DetailedScanResult | null>(null);
  const [showWhatGetsScanned, setShowWhatGetsScanned] = useState(false);
  const homeDiscoveryAbortRef = useRef<AbortController | null>(null);
  // Track FDA status locally so we can refresh it when modal opens
  const [canUseHomeSource, setCanUseHomeSource] = useState(
    !isMacPlatform || scanSettings.fullDiskAccessEnabled
  );
  const watchedDirectoryCount = scanSettings.watchedDirectories.length;

  const defaultSources = useMemo(() => {
    const defaults: ScanSource[] = [];
    if (canUseHomeSource) {
      defaults.push('home');
    }
    if (watchedDirectoryCount > 0) {
      defaults.push('watched');
    }
    return new Set(defaults);
  }, [canUseHomeSource, watchedDirectoryCount]);

  // Refresh FDA status when modal opens (in case user granted it and restarted)
  // Also re-check if the saved fullDiskAccessEnabled setting changes (e.g., from SettingsModal)
  useEffect(() => {
    if (isOpen && isMacPlatform) {
      checkFullDiskAccess()
        .then((granted) => {
          setCanUseHomeSource(granted);
        })
        .catch((err) => {
          devLog.error('Failed to check FDA status:', err);
          // Fallback to saved setting if TCC query fails
          setCanUseHomeSource(scanSettings.fullDiskAccessEnabled);
        });
    }
  }, [isOpen, isMacPlatform, scanSettings.fullDiskAccessEnabled]);

  useEffect(() => {
    if (isOpen) {
      setSelectedSources(new Set(defaultSources));
      setScanMessage(null);
    } else {
      homeDiscoveryAbortRef.current?.abort();
      setIsScanning(false);
      setIsDiscoveringHome(false);
      setCustomPaths([]);
      setRecursivePaths(new Set());
      cancelHomeDiscovery();
    }
  }, [isOpen, defaultSources]);

  useEffect(() => {
    return () => {
      homeDiscoveryAbortRef.current?.abort();
      cancelHomeDiscovery();
    };
  }, []);

  const toggleSource = (source: ScanSource) => {
    setSelectedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const handleCustomPath = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select directory to scan once',
      });

      if (typeof selected === 'string' && !customPaths.includes(selected)) {
        setCustomPaths(prev => [...prev, selected]);
        // Default to recursive (include subfolders)
        setRecursivePaths(prev => new Set(prev).add(selected));
      }
    } catch (error) {
      devLog.error('Failed to select directory:', error);
      showToast('error', 'Unable to add that folder. Please try again.');
    }
  };

  const removeCustomPath = (path: string) => {
    setCustomPaths(prev => prev.filter(entry => entry !== path));
    setRecursivePaths(prev => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const toggleRecursive = (path: string) => {
    setRecursivePaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const ensureHomeSource = () => {
    if (canUseHomeSource) {
      toggleSource('home');
    } else {
      showToast(
        'info',
        'Grant Full Disk Access in Settings → Permissions to include Desktop and Documents.'
      );
    }
  };

  const handleScan = async () => {
    if (isScanning || isDiscoveringHome) {
      return;
    }

    if (selectedSources.size === 0 && customPaths.length === 0 && !includeGlobalResources) {
      showToast('info', 'Select at least one source before scanning.');
      return;
    }

    setIsScanning(true);
    setScanMessage('Preparing sources…');

    let directories: string[] = [];
    // Include global resources (~/.claude/) if user selected it
    const includeGlobal = includeGlobalResources;

    if (selectedSources.has('watched') && watchedDirectoryCount > 0) {
      directories = directories.concat(scanSettings.watchedDirectories);
    }

    // Process custom paths - discover projects in subfolders if enabled
    if (customPaths.length > 0) {
      for (const path of customPaths) {
        if (recursivePaths.has(path)) {
          // Scan this directory recursively for projects
          setScanMessage(`Discovering projects in ${path}…`);
          try {
            const discovered = await scanDirectoryForProjects(path, {
              maxDepth: DEFAULT_HOME_DISCOVERY_DEPTH,
            });
            if (discovered.length > 0) {
              directories = directories.concat(discovered);
            } else {
              // No projects found in subfolders, add the path itself
              directories.push(path);
            }
          } catch (error) {
            devLog.error(`Failed to scan ${path}:`, error);
            // Fall back to treating it as a direct project path
            directories.push(path);
          }
        } else {
          // Just add the path directly (no recursive scan)
          directories.push(path);
        }
      }
    }

    if (selectedSources.has('home')) {
      if (!canUseHomeSource) {
        showToast(
          'info',
          'Grant Full Disk Access in Settings → Permissions to scan your home directory.'
        );
        setIsScanning(false);
        setSelectedSources(prev => {
          const next = new Set(prev);
          next.delete('home');
          return next;
        });
        setScanMessage(null);
        return;
      }

      setIsDiscoveringHome(true);
      setScanMessage('Discovering projects in your home directory…');
      const controller = new AbortController();
      homeDiscoveryAbortRef.current?.abort();
      homeDiscoveryAbortRef.current = controller;

      try {
        const discovered = await discoverHomeDirectories({
          maxDepth: DEFAULT_HOME_DISCOVERY_DEPTH,
          includeProtectedDirs: canUseHomeSource, // Scan Desktop/Documents/Downloads when FDA granted
          signal: controller.signal,
        });

        if (discovered.length === 0) {
          showToast('info', 'No project directories found in your home folder yet.');
        } else {
          directories = directories.concat(discovered);
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          devLog.error('Home discovery failed:', error);
          showToast('error', 'Unable to read your home directory. Try again.');
        }
        setIsScanning(false);
        setIsDiscoveringHome(false);
        setScanMessage(null);
        return;
      } finally {
        setIsDiscoveringHome(false);
        if (homeDiscoveryAbortRef.current === controller) {
          homeDiscoveryAbortRef.current = null;
        }
      }
    }

    const uniqueDirectories = Array.from(
      new Set(
        directories
          .map(path => path.trim())
          .filter(Boolean)
      )
    );

    // If global is selected or directories are specified, proceed with scan

    try {
      setScanMessage('Scanning selected sources…');
      const result = await onScan({
        includeGlobal,
        projectPaths: uniqueDirectories.length > 0 ? uniqueDirectories : undefined,
      });
      setLastResult(result);
      setScanMessage(null);
      showToast(
        'success',
        result.newCount === 0
          ? 'Scan complete — no new resources found.'
          : `Scan complete — ${result.newCount} new resource${result.newCount === 1 ? '' : 's'} found.`
      );
    } catch (error) {
      devLog.error('Scan failed:', error);
      showToast('error', 'Scan failed. Please try again.');
      setScanMessage(null);
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  const sourcesSummary = [
    includeGlobalResources ? 'Global (~/.claude/)' : null,
    selectedSources.has('home') ? 'Home directory' : null,
    selectedSources.has('watched') ? `Watched folders (${watchedDirectoryCount || 0})` : null,
    customPaths.length > 0 ? `${customPaths.length} specific folder${customPaths.length === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <AnimatePresence>
      <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => (!isScanning && !isDiscoveringHome) && onClose()}
          className="fixed inset-0 bg-black/50 z-[9999]"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          onClick={() => (!isScanning && !isDiscoveringHome) && onClose()}
        >
          <div
            className="w-full max-w-3xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-v-light-border dark:border-v-border">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                  Scan
                </p>
                <h2 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Discover Claude Code resources
                </h2>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                  Find subagents, skills, memory files, commands, and more across your computer
                </p>
              </div>
              <button
                onClick={onClose}
                disabled={isScanning || isDiscoveringHome}
                className="p-2 rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close scan modal"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              <section>
                <p className="text-sm font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Sources
                </p>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                  Select the sources you want to scan for Claude Code resources.
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SourceChip
                    label="Home directory"
                    description={
                      canUseHomeSource
                        ? 'Scan all projects in your home folder.'
                        : 'Requires Full Disk Access.'
                    }
                    active={selectedSources.has('home')}
                    disabled={(!canUseHomeSource && isMacPlatform) || isScanning || isDiscoveringHome}
                    onClick={ensureHomeSource}
                  />

                  <SourceChip
                    label="Watched folders"
                    description={
                      watchedDirectoryCount > 0
                        ? `${watchedDirectoryCount} folder${watchedDirectoryCount === 1 ? '' : 's'}`
                        : 'Configured in Settings.'
                    }
                    active={selectedSources.has('watched')}
                    disabled={watchedDirectoryCount === 0 || isScanning || isDiscoveringHome}
                    onClick={() => toggleSource('watched')}
                  />

                  <SourceChip
                    label="Global resources"
                    description="~/.claude/ directory"
                    active={includeGlobalResources}
                    disabled={isScanning || isDiscoveringHome}
                    onClick={() => setIncludeGlobalResources(prev => !prev)}
                  />

                  <button
                    type="button"
                    onClick={handleCustomPath}
                    disabled={isScanning || isDiscoveringHome}
                    className="px-4 py-3 rounded-xl border border-dashed border-v-light-border dark:border-v-border bg-v-light-bg/60 dark:bg-v-dark/60 text-left text-v-accent hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="text-sm font-semibold">+ Specific folder/s</p>
                    <p className="text-xs mt-1 text-v-light-text-secondary dark:text-v-text-secondary">
                      One-time scan without saving.
                    </p>
                  </button>
                </div>


                {customPaths.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {customPaths.map(path => (
                      <div
                        key={path}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg border border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark text-sm text-v-light-text-primary dark:text-v-text-primary"
                      >
                        <span className="truncate flex-1 min-w-0">{path}</span>
                        <label className="flex items-center gap-1.5 text-xs text-v-light-text-secondary dark:text-v-text-secondary whitespace-nowrap cursor-pointer" title="Recursively scan for projects within this folder">
                          <input
                            type="checkbox"
                            checked={recursivePaths.has(path)}
                            onChange={() => toggleRecursive(path)}
                            disabled={isScanning || isDiscoveringHome}
                            className="w-3.5 h-3.5 rounded border-v-light-border dark:border-v-border text-v-accent focus:ring-v-accent focus:ring-offset-0"
                          />
                          Include subfolders
                        </label>
                        <button
                          type="button"
                          onClick={() => removeCustomPath(path)}
                          disabled={isScanning || isDiscoveringHome}
                          className="text-v-danger hover:text-v-danger/80 disabled:opacity-50"
                          aria-label={`Remove ${path}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* What gets scanned - expandable section */}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowWhatGetsScanned(prev => !prev)}
                    className="text-xs text-v-accent hover:text-v-accent-hover flex items-center gap-1"
                  >
                    <svg
                      className={`w-3 h-3 transition-transform ${showWhatGetsScanned ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    What gets scanned?
                  </button>
                  {showWhatGetsScanned && (
                    <div className="mt-2 p-3 rounded-lg bg-v-light-bg/50 dark:bg-v-dark/50 border border-v-light-border/50 dark:border-v-border/50">
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mb-2">
                        Vinsly looks for Claude Code resources in these locations:
                      </p>
                      <ul className="text-xs text-v-light-text-secondary dark:text-v-text-secondary space-y-1 font-mono">
                        <li><span className="text-v-accent">.claude/agents/</span> — Agent definitions</li>
                        <li><span className="text-v-accent">.claude/skills/</span> — Skill packages</li>
                        <li><span className="text-v-accent">.claude/commands/</span> — Slash commands</li>
                        <li><span className="text-v-accent">CLAUDE.md</span> — Memory files</li>
                        <li><span className="text-v-accent">.claude/settings.json</span> — Hooks configuration</li>
                        <li><span className="text-v-accent">.mcp.json</span> — MCP server configs</li>
                      </ul>
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-3">
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={isScanning || isDiscoveringHome}
                  className="w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-semibold text-white bg-v-accent hover:bg-v-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(isScanning || isDiscoveringHome) && (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="60" strokeDashoffset="20" strokeLinecap="round" />
                    </svg>
                  )}
                  {isScanning || isDiscoveringHome ? 'Scanning…' : 'Scan now'}
                </button>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
                  Sources: {sourcesSummary || 'None selected'}
                </p>
                {scanMessage && (
                  <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary text-center">
                    {scanMessage}
                  </p>
                )}
              </section>

              {lastResult && (
                <div className="border border-v-light-border dark:border-v-border rounded-xl px-4 py-3 bg-v-light-bg/60 dark:bg-v-dark/60">
                  <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                    Last scan
                  </p>
                  <p className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary mt-1">
                    {lastResult.newCount} new resource{lastResult.newCount === 1 ? '' : 's'} found
                  </p>
                  <div className="mt-3 max-h-32 overflow-y-auto">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {lastResult.breakdown.agents.total > 0 && (
                        <div className="text-xs">
                          <span className="text-v-light-text-secondary dark:text-v-text-secondary">Agents:</span>{' '}
                          <span className="text-v-light-text-primary dark:text-v-text-primary font-medium">
                            {lastResult.breakdown.agents.total}
                            {lastResult.breakdown.agents.new > 0 && (
                              <span className="text-v-accent ml-1">(+{lastResult.breakdown.agents.new})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {lastResult.breakdown.commands.total > 0 && (
                        <div className="text-xs">
                          <span className="text-v-light-text-secondary dark:text-v-text-secondary">Commands:</span>{' '}
                          <span className="text-v-light-text-primary dark:text-v-text-primary font-medium">
                            {lastResult.breakdown.commands.total}
                            {lastResult.breakdown.commands.new > 0 && (
                              <span className="text-v-accent ml-1">(+{lastResult.breakdown.commands.new})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {lastResult.breakdown.mcpServers.total > 0 && (
                        <div className="text-xs">
                          <span className="text-v-light-text-secondary dark:text-v-text-secondary">MCP Servers:</span>{' '}
                          <span className="text-v-light-text-primary dark:text-v-text-primary font-medium">
                            {lastResult.breakdown.mcpServers.total}
                            {lastResult.breakdown.mcpServers.new > 0 && (
                              <span className="text-v-accent ml-1">(+{lastResult.breakdown.mcpServers.new})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {lastResult.breakdown.hooks.total > 0 && (
                        <div className="text-xs">
                          <span className="text-v-light-text-secondary dark:text-v-text-secondary">Hooks:</span>{' '}
                          <span className="text-v-light-text-primary dark:text-v-text-primary font-medium">
                            {lastResult.breakdown.hooks.total}
                            {lastResult.breakdown.hooks.new > 0 && (
                              <span className="text-v-accent ml-1">(+{lastResult.breakdown.hooks.new})</span>
                            )}
                          </span>
                        </div>
                      )}
                      {lastResult.breakdown.memories.total > 0 && (
                        <div className="text-xs">
                          <span className="text-v-light-text-secondary dark:text-v-text-secondary">Memories:</span>{' '}
                          <span className="text-v-light-text-primary dark:text-v-text-primary font-medium">
                            {lastResult.breakdown.memories.total}
                            {lastResult.breakdown.memories.new > 0 && (
                              <span className="text-v-accent ml-1">(+{lastResult.breakdown.memories.new})</span>
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                    {lastResult.total === 0 && (
                      <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        No resources found in the selected sources.
                      </p>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
};
