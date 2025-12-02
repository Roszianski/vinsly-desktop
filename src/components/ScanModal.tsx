import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { useToast } from '../contexts/ToastContext';
import { cancelHomeDiscovery, DEFAULT_HOME_DISCOVERY_DEPTH, discoverHomeDirectories } from '../utils/homeDiscovery';
import { LoadAgentsOptions, ScanSettings } from '../types';

type ScanSource = 'home' | 'watched' | 'global';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (options?: LoadAgentsOptions) => Promise<{ total: number; newCount: number }>;
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
        : 'border-v-light-border dark:border-v-border text-v-light-text-secondary dark:text-v-text-secondary hover:border-v-accent'
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
  const [customPaths, setCustomPaths] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isDiscoveringHome, setIsDiscoveringHome] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{ total: number; newCount: number } | null>(null);
  const homeDiscoveryAbortRef = useRef<AbortController | null>(null);

  const canUseHomeSource = !isMacPlatform || scanSettings.fullDiskAccessEnabled;
  const watchedDirectoryCount = scanSettings.watchedDirectories.length;

  const defaultSources = useMemo(() => {
    const defaults: ScanSource[] = [];
    if (canUseHomeSource) {
      defaults.push('home');
    }
    if (watchedDirectoryCount > 0) {
      defaults.push('watched');
    }
    if (defaults.length === 0) {
      defaults.push('global');
    }
    return new Set(defaults);
  }, [canUseHomeSource, watchedDirectoryCount]);

  useEffect(() => {
    if (isOpen) {
      setSelectedSources(new Set(defaultSources));
      setScanMessage(null);
    } else {
      homeDiscoveryAbortRef.current?.abort();
      setIsScanning(false);
      setIsDiscoveringHome(false);
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
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
      showToast('error', 'Unable to add that folder. Please try again.');
    }
  };

  const removeCustomPath = (path: string) => {
    setCustomPaths(prev => prev.filter(entry => entry !== path));
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

    if (selectedSources.size === 0 && customPaths.length === 0) {
      showToast('info', 'Select at least one source before scanning.');
      return;
    }

    setIsScanning(true);
    setScanMessage('Preparing sources…');

    let directories: string[] = [];
    const includeGlobal = selectedSources.has('global');

    if (selectedSources.has('watched') && watchedDirectoryCount > 0) {
      directories = directories.concat(scanSettings.watchedDirectories);
    }

    if (customPaths.length > 0) {
      directories = directories.concat(customPaths);
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
          includeProtectedDirs: canUseHomeSource,
          signal: controller.signal,
        });

        if (discovered.length === 0) {
          showToast('info', 'No project directories found in your home folder yet.');
        } else {
          directories = directories.concat(discovered);
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === 'AbortError')) {
          console.error('Home discovery failed:', error);
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

    if (!includeGlobal && uniqueDirectories.length === 0) {
      setIsScanning(false);
      setScanMessage(null);
      showToast('info', 'Add at least one folder or enable global scanning.');
      return;
    }

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
      console.error('Scan failed:', error);
      showToast('error', 'Scan failed. Please try again.');
      setScanMessage(null);
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  const sourcesSummary = [
    selectedSources.has('home') ? 'Home directory' : null,
    selectedSources.has('watched') ? `Watched folders (${watchedDirectoryCount || 0})` : null,
    selectedSources.has('global') ? 'Global resources (~/.claude/)' : null,
    customPaths.length > 0 ? `${customPaths.length} custom folder${customPaths.length === 1 ? '' : 's'}` : null,
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
        >
          <div className="w-full max-w-3xl bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-v-light-border dark:border-v-border">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-v-light-text-secondary dark:text-v-text-secondary">
                  Scan
                </p>
                <h2 className="text-xl font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Find Claude Code resources
                </h2>
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
                  Pick your sources
                </p>
                <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                  Turn on one or multiple sources. Vinsly scans everything you enable below.
                </p>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SourceChip
                    label="Home directory"
                    description="Scan your entire home directory - requires macOS Full Disk Access."
                    active={selectedSources.has('home')}
                    disabled={(!canUseHomeSource && isMacPlatform) || isScanning || isDiscoveringHome}
                    onClick={ensureHomeSource}
                  />

                  <SourceChip
                    label="Watched folders"
                    description={
                      watchedDirectoryCount > 0
                        ? `${watchedDirectoryCount} folder${watchedDirectoryCount === 1 ? '' : 's'}`
                        : 'Add folders in Settings → Scanning'
                    }
                    active={selectedSources.has('watched')}
                    disabled={watchedDirectoryCount === 0 || isScanning || isDiscoveringHome}
                    onClick={() => toggleSource('watched')}
                  />

                  <SourceChip
                    label="Global resources"
                    description="~/.claude/"
                    active={selectedSources.has('global')}
                    disabled={isScanning || isDiscoveringHome}
                    onClick={() => toggleSource('global')}
                  />

                  <button
                    type="button"
                    onClick={handleCustomPath}
                    disabled={isScanning || isDiscoveringHome}
                    className="px-4 py-3 rounded-xl border border-dashed border-v-light-border dark:border-v-border text-left text-v-accent hover:border-v-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <p className="text-sm font-semibold">+ Custom folder</p>
                    <p className="text-xs mt-1 text-v-light-text-secondary dark:text-v-text-secondary">
                      Scan one or more specific folders without adding to watched directories
                    </p>
                  </button>
                </div>

                {!canUseHomeSource && isMacPlatform && (
                  <div className="mt-3 text-xs text-amber-600 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/40 rounded-lg px-3 py-2">
                    Grant Full Disk Access in Settings → Permissions to scan Desktop and Documents automatically.
                  </div>
                )}

                {customPaths.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {customPaths.map(path => (
                      <div
                        key={path}
                        className="flex items-center justify-between px-3 py-2 rounded-lg border border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark text-sm text-v-light-text-primary dark:text-v-text-primary"
                      >
                        <span className="truncate">{path}</span>
                        <button
                          type="button"
                          onClick={() => removeCustomPath(path)}
                          className="ml-3 text-v-danger hover:text-v-danger/80"
                          aria-label={`Remove ${path}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
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
                    {lastResult.newCount} new resource{lastResult.newCount === 1 ? '' : 's'} • {lastResult.total} total files scanned
                  </p>
                </div>
              )}

              {(!isMacPlatform || !scanSettings.fullDiskAccessEnabled) && (
                <div className="text-xs text-v-light-text-secondary dark:text-v-text-secondary border border-dashed border-v-light-border dark:border-v-border rounded-lg px-3 py-2">
                  Prefer selective access? Leave Full Disk Access off and add Desktop, Documents, or any other folder manually under Settings → Scanning → Watched Directories.
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </>
    </AnimatePresence>
  );
};
