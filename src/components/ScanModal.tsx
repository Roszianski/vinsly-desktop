import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { open } from '@tauri-apps/plugin-dialog';
import { useToast } from '../contexts/ToastContext';
import { FolderIcon } from './icons/FolderIcon';
import { NetworkIcon } from './icons/NetworkIcon';
import { discoverProjectDirectories } from '../utils/tauriCommands';
import { LoadAgentsOptions, ScanSettings } from '../types';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (options?: LoadAgentsOptions) => Promise<{ total: number; newCount: number }>;
  scanSettings: ScanSettings;
}

type ScanType = 'global' | 'project' | 'home' | 'watched' | null;

const startManagedInterval = (callback: () => void, delay: number) => {
  const id = window.setInterval(callback, delay);
  return () => window.clearInterval(id);
};

export const ScanModal: React.FC<ScanModalProps> = ({ isOpen, onClose, onScan, scanSettings }) => {
  const { showToast } = useToast();
  const [isScanning, setIsScanning] = useState(false);
  const [scanType, setScanType] = useState<ScanType>(null);
  const [progress, setProgress] = useState(0);
  const [dirsScanned, setDirsScanned] = useState(0);
  const [agentsFound, setAgentsFound] = useState(0);
  const [projectPaths, setProjectPaths] = useState<string[]>([]);
  const [projectHintActive, setProjectHintActive] = useState(false);
  const [scanningHome, setScanningHome] = useState(false);
  const [homeScanTrail, setHomeScanTrail] = useState<string[]>([]);
  const [activeScanDetail, setActiveScanDetail] = useState<string | null>(null);
  const watchedDirectoryCount = scanSettings.watchedDirectories.length;
  const watchedAutoScanEnabled = scanSettings.autoScanHomeDirectoryOnStartup;
  const showWatchedAutoInfo = watchedDirectoryCount > 0 && watchedAutoScanEnabled;
  const scanSummaryLabel = (() => {
    switch (scanType) {
      case 'project':
        return 'Project scan';
      case 'home':
        return 'Home directory scan';
      case 'watched':
        return 'Watched directories scan';
      case 'global':
        return 'Global scan';
      default:
        return 'Scan';
    }
  })();

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setIsScanning(false);
      setScanType(null);
      setProgress(0);
      setDirsScanned(0);
      setAgentsFound(0);
      setProjectPaths([]);
      setProjectHintActive(false);
      setScanningHome(false);
      setHomeScanTrail([]);
      setActiveScanDetail(null);
    }
  }, [isOpen]);

  const handleScanGlobal = async () => {
    if (isScanning) return;
    const globalAgentsPath = '~/.claude/agents';

    setScanType('global');
    setIsScanning(true);
    setProgress(0);
    setDirsScanned(0);
    setActiveScanDetail(globalAgentsPath);
    let stopInterval: (() => void) | null = null;

    try {
      // Simulate directory scanning progress
      stopInterval = startManagedInterval(() => {
        setDirsScanned(prev => prev + 1);
        setProgress(prev => Math.min(prev + 5, 95));
      }, 50);

      const result = await onScan({ includeGlobal: true });

      setProgress(100);
      setAgentsFound(result.newCount);
      setDirsScanned(prev => Math.max(prev, 1));
      setIsScanning(false);
    } catch (error) {
      console.error('Scan failed:', error);
      showToast('error', 'Failed to scan for agents');
      setIsScanning(false);
    } finally {
      stopInterval?.();
      setActiveScanDetail(null);
    }
  };

  const handleScanHome = async () => {
    if (isScanning || scanningHome) return;
    setScanningHome(true);
    setScanType('home');
    setIsScanning(true);
    setProgress(0);
    setDirsScanned(0);
    setHomeScanTrail([]);
    setActiveScanDetail('Discovering home directories…');
    let stopInterval: (() => void) | null = null;

    try {
      const directories = await discoverProjectDirectories(12);
      if (directories.length === 0) {
        setAgentsFound(0);
        setIsScanning(false);
        setScanningHome(false);
        setHomeScanTrail([]);
        setActiveScanDetail(null);
        showToast('info', 'No project directories found in your home folder.');
        return;
      }

      stopInterval = startManagedInterval(() => {
        setDirsScanned(prev => {
          if (prev >= directories.length) {
            return prev;
          }
          const next = prev + 1;
          const currentDir = directories[next - 1];
          if (currentDir) {
            setActiveScanDetail(currentDir);
            setHomeScanTrail(prevTrail => {
              const updated = [...prevTrail, currentDir];
              return updated.slice(-3);
            });
          }
          return next;
        });
        setProgress(prev => Math.min(prev + 5, 95));
      }, 50);

      const result = await onScan({ projectPaths: directories });

      setProgress(100);
      setAgentsFound(result.newCount);
      setDirsScanned(directories.length);
    } catch (error) {
      console.error('Home scan failed:', error);
      showToast('error', 'Failed to scan home directory for project agents');
    } finally {
      stopInterval?.();
      setIsScanning(false);
      setScanningHome(false);
      setHomeScanTrail([]);
      setActiveScanDetail(null);
    }
  };

  const handleScanProject = async () => {
    if (isScanning) return;
    const selectedPaths = [...projectPaths];
    if (selectedPaths.length === 0) {
      setProjectHintActive(true);
      return;
    }

    let stopInterval: (() => void) | null = null;

    try {
      setScanType('project');
      setIsScanning(true);
      setProgress(0);
      setDirsScanned(0);
      setProjectHintActive(false);
      setActiveScanDetail(selectedPaths[0] || null);

      // Simulate directory scanning progress
      stopInterval = startManagedInterval(() => {
        setDirsScanned(prev => {
          if (prev >= selectedPaths.length) {
            return prev;
          }
          const next = prev + 1;
          const currentDir = selectedPaths[next - 1] || selectedPaths[selectedPaths.length - 1];
          if (currentDir) {
            setActiveScanDetail(currentDir);
          }
          return next;
        });
        setProgress(prev => Math.min(prev + 10, 95));
      }, 30);

      const result = await onScan({ projectPaths: selectedPaths });

      setProgress(100);
      setAgentsFound(result.newCount);
      setDirsScanned(selectedPaths.length || 1);
      setIsScanning(false);
    } catch (error) {
      console.error('Scan failed:', error);
      showToast('error', 'Failed to scan for agents');
      setIsScanning(false);
    } finally {
      stopInterval?.();
      setActiveScanDetail(null);
    }
  };

  const handleScanWatched = async () => {
    if (isScanning) return;
    const directories = [...scanSettings.watchedDirectories];
    if (directories.length === 0) {
      showToast('info', 'Add watched directories in Settings before scanning.');
      return;
    }

    setScanType('watched');
    setIsScanning(true);
    setProgress(0);
    setDirsScanned(0);
    setActiveScanDetail(directories[0] || null);

    let stopInterval: (() => void) | null = null;

    const total = directories.length;

    stopInterval = startManagedInterval(() => {
      setDirsScanned(prev => {
        if (prev >= total) {
          return prev;
        }
        const next = prev + 1;
        const currentDir = directories[next - 1] || directories[directories.length - 1];
        if (currentDir) {
          setActiveScanDetail(currentDir);
        }
        return next;
      });
      setProgress(prev => Math.min(prev + 8, 95));
    }, 40);

    try {
      const result = await onScan({ scanWatchedDirectories: true });

      setProgress(100);
      setAgentsFound(result.newCount);
      setDirsScanned(Math.max(total, 1));
      setIsScanning(false);
    } catch (error) {
      console.error('Watched directories scan failed:', error);
      showToast('error', 'Failed to scan watched directories');
      setIsScanning(false);
    } finally {
      stopInterval?.();
      setActiveScanDetail(null);
    }
  };

  const handleChooseProjectFolder = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isScanning) return;

    try {
      // Briefly delay to ensure modal is fully rendered
      await new Promise(resolve => setTimeout(resolve, 100));

      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory to Scan'
      });

      if (!selectedPath || typeof selectedPath !== 'string') return; // User cancelled

      setProjectPaths(prev =>
        prev.includes(selectedPath) ? prev : [...prev, selectedPath]
      );
      setProjectHintActive(false);
    } catch (error) {
      console.error('Failed to select project folder:', error);
      showToast('error', 'Failed to select project folder');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isScanning && onClose()}
          className="fixed inset-0 bg-black/50 z-[9999]"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-full max-w-[min(90vw,1500px)] max-h-[85vh] bg-v-light-surface dark:bg-v-mid-dark border border-v-light-border dark:border-v-border rounded-xl shadow-2xl flex flex-col">
            <div className="p-6 pb-4 flex-shrink-0">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-v-light-text-primary dark:text-v-text-primary">
                  Scan for Agents
                </h2>
                <button
                onClick={onClose}
                disabled={isScanning}
                className="text-v-light-text-secondary dark:text-v-text-secondary hover:text-v-light-text-primary dark:hover:text-v-text-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 pb-6">
              <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary">
                Choose how you’d like Vinsly to look for agents.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={handleScanGlobal}
                  disabled={isScanning}
                  className="w-full h-full px-4 py-4 text-left bg-v-light-bg dark:bg-v-dark border-2 border-v-light-border dark:border-v-border rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark hover:border-v-accent transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5 text-v-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium text-v-light-text-primary dark:text-v-text-primary group-hover:text-v-accent transition-colors">
                        Scan Globally
                      </div>
                      <div className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        Scan ~/.claude/agents/ for all global agent files.
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={handleScanHome}
                  disabled={isScanning || scanningHome}
                  className="w-full h-full px-4 py-4 text-left bg-v-light-bg dark:bg-v-dark border-2 border-v-light-border dark:border-v-border rounded-lg hover:bg-v-light-hover dark:hover:bg-v-light-dark hover:border-v-accent transition-colors group disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5 text-v-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 11.25L12 4l9 7.25"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5.25 10.5V20h5.5v-4.5h2.5V20h5.5v-9.5"
                      />
                    </svg>
                    <div className="flex-1">
                      <div className="font-medium text-v-light-text-primary dark:text-v-text-primary group-hover:text-v-accent transition-colors">
                        Scan home projects
                      </div>
                      <div className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        Scan your home directory for every `.claude/agents` folder.
                      </div>
                      {scanningHome && homeScanTrail.length > 0 && (
                        <div className="mt-3 rounded-lg border border-v-light-border/70 dark:border-v-border/60 bg-v-light-hover/70 dark:bg-v-light-dark/40 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-wide text-v-light-text-secondary dark:text-v-text-secondary">
                            Scanning folders
                          </p>
                          <div className="mt-1 space-y-1">
                            {homeScanTrail
                              .slice()
                              .reverse()
                              .map((directory, index) => (
                                <div
                                  key={`${directory}-${index}`}
                                  className="text-[11px] font-mono text-v-light-text-primary dark:text-v-text-primary truncate"
                                  title={directory}
                                >
                                  {directory}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>

                <div
                  className={`relative w-full px-4 py-4 text-left rounded-lg border-2 transition-colors ${
                    projectHintActive && projectPaths.length === 0
                      ? 'border-v-danger dark:border-v-danger'
                      : 'border-v-light-border dark:border-v-border'
                  } bg-v-light-bg dark:bg-v-dark`}
                >
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 mt-0.5 text-v-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <div className="flex-1 pr-2">
                      <div className="font-medium text-v-light-text-primary dark:text-v-text-primary">
                        Project scan
                      </div>
                      <p className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        Select one or more project folders, then run a targeted scan.
                      </p>
                      {projectPaths.length === 0 && (
                        <p className="mt-2 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                          No project folders selected yet.
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {projectPaths.length > 0 ? (
                          <>
                            <div className="flex items-center gap-2 text-xs bg-v-light-bg dark:bg-v-dark/60 rounded-md px-2 py-1 border border-v-light-border/60 dark:border-v-border/60">
                              <FolderIcon className="w-3.5 h-3.5 text-v-accent flex-shrink-0" />
                              <span className="font-mono text-[11px] text-v-light-text-primary dark:text-v-text-primary truncate max-w-[220px]">
                                {projectPaths[projectPaths.length - 1]}
                              </span>
                            </div>
                            {projectPaths.length > 1 && (
                              <span className="px-2 py-1 rounded-full text-[11px] font-semibold bg-v-light-hover dark:bg-v-light-dark text-v-light-text-secondary dark:text-v-text-secondary border border-dashed border-v-light-border/80 dark:border-v-border/80">
                                +{projectPaths.length - 1}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                            No project folders selected yet.
                          </span>
                        )}
                      </div>
                      {projectHintActive && projectPaths.length === 0 && (
                        <p className="mt-2 text-xs text-v-danger">
                          Add at least one folder before scanning.
                        </p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          type="button"
                          onClick={handleChooseProjectFolder}
                          disabled={isScanning}
                          className="px-3 py-2 rounded-lg border border-v-light-border dark:border-v-border text-sm text-v-light-text-primary dark:text-v-text-primary hover:border-v-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          <FolderIcon className="h-4 w-4 text-v-accent" />
                          Add folder
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (projectPaths.length === 0) {
                              setProjectHintActive(true);
                              return;
                            }
                            setProjectHintActive(false);
                            handleScanProject();
                          }}
                          disabled={isScanning || projectPaths.length === 0}
                          className="px-4 py-2 rounded-lg bg-v-accent text-white text-sm font-semibold hover:bg-v-accent-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {projectPaths.length === 0 ? 'Select folders first' : 'Scan selected folders'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (watchedDirectoryCount === 0) {
                      showToast('info', 'No watched directories yet. Add them from Settings → Agent discovery.');
                      return;
                    }
                    handleScanWatched();
                  }}
                  disabled={isScanning}
                  className={`w-full h-full px-4 py-4 text-left rounded-lg border-2 transition-colors group md:col-span-1 ${
                    watchedDirectoryCount === 0
                      ? 'border-dashed border-v-light-border/70 dark:border-v-border/70 cursor-not-allowed bg-v-light-bg/70 dark:bg-v-dark/70'
                      : 'border-v-light-border dark:border-v-border bg-v-light-bg dark:bg-v-dark hover:border-v-accent'
                  } ${isScanning ? 'opacity-60 cursor-not-allowed' : ''}`}
                  aria-disabled={watchedDirectoryCount === 0}
                  title={watchedDirectoryCount === 0 ? 'Add watched directories in Settings first' : undefined}
                >
                  <div className="flex items-start gap-3">
                    <NetworkIcon className={`w-5 h-5 mt-0.5 ${watchedDirectoryCount === 0 ? 'text-v-light-text-secondary' : 'text-v-accent'}`} />
                    <div className="flex-1">
                      <div
                        className={`font-medium ${
                          watchedDirectoryCount === 0 ? 'text-v-light-text-secondary dark:text-v-text-secondary' : 'text-v-light-text-primary dark:text-v-text-primary'
                        }`}
                      >
                        Scan watched directories
                      </div>
                      <div className="text-sm text-v-light-text-secondary dark:text-v-text-secondary mt-1">
                        {watchedDirectoryCount === 0
                          ? 'No watched directories configured yet.'
                          : `Check the ${watchedDirectoryCount} custom folder${watchedDirectoryCount === 1 ? '' : 's'} you’re watching in Settings.`}
                      </div>
                      <p className="mt-2 text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                        {watchedDirectoryCount === 0
                          ? 'Add folders in Settings → Agent discovery to enable this.'
                          : 'Update this list in Settings → Agent discovery.'}
                      </p>
                    </div>
                  </div>
                </button>

                {showWatchedAutoInfo && (
                  <div className="px-4 py-3 text-xs text-v-light-text-secondary dark:text-v-text-secondary bg-v-light-bg dark:bg-v-dark border-2 border-dashed border-v-light-border/70 dark:border-v-border/60 rounded-lg md:col-span-2">
                    Watched directories sync automatically on launch because home auto-scan is enabled.
                  </div>
                )}
              </div>


            </div>
            <div className="p-6 pt-4 border-t border-v-light-border dark:border-v-border space-y-3 flex-shrink-0 bg-v-light-surface dark:bg-v-mid-dark">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isScanning ? (
                    <svg className="w-6 h-6 animate-spin text-v-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-v-light-bg dark:bg-v-dark flex items-center justify-center border border-v-light-border dark:border-v-border">
                      <svg className="w-4 h-4 text-v-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-v-light-text-primary dark:text-v-text-primary">
                      {progress === 0 && !isScanning ? 'Ready to scan' : isScanning ? 'Scanning…' : 'Scan complete'}
                    </p>
                    <p className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                      {scanSummaryLabel} · Directories scanned: {dirsScanned} · Found {agentsFound} new agent{agentsFound !== 1 ? 's' : ''}
                    </p>
                    {activeScanDetail && (
                      <p className="text-[11px] text-v-light-text-secondary dark:text-v-text-secondary font-mono truncate">
                        Currently scanning: {activeScanDetail}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-v-light-text-secondary dark:text-v-text-secondary">
                  {progress}%
                </span>
              </div>

              <div className="w-full bg-v-light-border dark:bg-v-border rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-v-accent"
                />
              </div>

            </div>
          </div>
        </div>
      </motion.div>
      </>
    </AnimatePresence>
  );
};
