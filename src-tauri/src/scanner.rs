use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use walkdir::WalkDir;

pub const DEFAULT_DISCOVERY_DEPTH: usize = 12;

/// Directories that are ALWAYS skipped (never contain code projects)
#[cfg(target_os = "macos")]
fn always_skip_dirs(home_dir: &Path) -> Vec<PathBuf> {
    vec![
        home_dir.join("Applications"),
        home_dir.join("Movies"),
        home_dir.join("Music"),
        home_dir.join("Pictures"),
        home_dir.join("Public"),
        home_dir.join("Library"),
        home_dir.join("Library").join("Mobile Documents"),
        home_dir.join("Library").join("CloudStorage"),
        home_dir.join("Library").join("Containers"),
    ]
}

/// Directories that require FDA to scan (may contain code projects)
#[cfg(target_os = "macos")]
fn protected_docs_dirs(home_dir: &Path) -> Vec<PathBuf> {
    vec![
        home_dir.join("Desktop"),
        home_dir.join("Documents"),
        home_dir.join("Downloads"),
    ]
}

#[cfg(not(target_os = "macos"))]
fn always_skip_dirs(_home_dir: &Path) -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(not(target_os = "macos"))]
fn protected_docs_dirs(_home_dir: &Path) -> Vec<PathBuf> {
    Vec::new()
}

pub fn scan_project_directories(
    home_dir: PathBuf,
    depth: usize,
    include_protected: bool,
) -> Result<Vec<String>, String> {
    use std::ffi::OsStr;

    let mut directories = Vec::new();
    let always_skip = always_skip_dirs(&home_dir);
    let protected_docs = protected_docs_dirs(&home_dir);
    let global_agents_dir = home_dir.join(".claude");
    let skip_dir_names = [".Trash", "node_modules", ".git", ".cache", ".npm"];

    let walker = WalkDir::new(&home_dir)
        .max_depth(depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            let path = entry.path();

            // Always skip directories that never contain code projects
            if always_skip.iter().any(|skip| path.starts_with(skip)) {
                return false;
            }

            // Skip protected docs directories (Desktop/Documents/Downloads) unless FDA enabled
            if !include_protected {
                if protected_docs.iter().any(|protected| path.starts_with(protected)) {
                    return false;
                }
            }

            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if skip_dir_names.contains(&name) {
                    return false;
                }
            }
            true
        });

    for entry in walker {
        match entry {
            Ok(entry) => {
                let file_name = entry.file_name();

                // Check for .claude directories
                if entry.file_type().is_dir() && file_name == OsStr::new(".claude") {
                    // Skip the global ~/.claude directory
                    if entry.path() == global_agents_dir {
                        continue;
                    }

                    // Check if this .claude directory has any Claude Code resources
                    let has_claude_content = entry.path().join("agents").exists()
                        || entry.path().join("skills").exists()
                        || entry.path().join("commands").exists()
                        || entry.path().join("settings.json").exists()
                        || entry.path().join("settings.local.json").exists();

                    // Also check for CLAUDE.md or .mcp.json in the project root
                    let project_root = entry.path().parent();
                    let has_root_content = project_root.map_or(false, |root| {
                        root.join("CLAUDE.md").exists() || root.join(".mcp.json").exists()
                    });

                    if has_claude_content || has_root_content {
                        if let Some(project_root) = project_root {
                            directories.push(project_root.to_string_lossy().to_string());
                        }
                    }
                }

                // Also check for standalone CLAUDE.md or .mcp.json files (without .claude/ directory)
                if entry.file_type().is_file() {
                    let is_claude_md = file_name == OsStr::new("CLAUDE.md");
                    let is_mcp_json = file_name == OsStr::new(".mcp.json");

                    if is_claude_md || is_mcp_json {
                        if let Some(project_root) = entry.path().parent() {
                            // Only add if this directory doesn't already have a .claude folder
                            // (those are handled above and we don't want duplicates)
                            if !project_root.join(".claude").exists() {
                                // Skip if this is the home directory itself (global CLAUDE.md)
                                if project_root != home_dir {
                                    directories.push(project_root.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
            Err(err) => {
                if let Some(io_err) = err.io_error() {
                    match io_err.kind() {
                        ErrorKind::PermissionDenied | ErrorKind::TimedOut => continue,
                        _ => {}
                    }
                }
                eprintln!("Skipping directory due to error: {}", err);
                continue;
            }
        }
    }

    directories.sort();
    directories.dedup();
    Ok(directories)
}

/// Scan a specific directory recursively for Claude Code projects.
/// Unlike scan_project_directories, this doesn't skip system directories
/// since we're scanning a user-specified path.
pub fn scan_directory(
    root_dir: PathBuf,
    depth: usize,
) -> Result<Vec<String>, String> {
    use std::ffi::OsStr;

    let mut directories = Vec::new();
    let skip_dir_names = [".Trash", "node_modules", ".git", ".cache", ".npm"];

    // Get home dir to identify global .claude (should not be returned as a project)
    let global_claude_dir = dirs::home_dir().map(|h| h.join(".claude"));

    let walker = WalkDir::new(&root_dir)
        .max_depth(depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if skip_dir_names.contains(&name) {
                    return false;
                }
            }
            true
        });

    for entry in walker {
        match entry {
            Ok(entry) => {
                let file_name = entry.file_name();

                // Check for .claude directories
                if entry.file_type().is_dir() && file_name == OsStr::new(".claude") {
                    // Skip the global ~/.claude directory
                    if let Some(ref global) = global_claude_dir {
                        if entry.path() == global.as_path() {
                            continue;
                        }
                    }

                    // Check if this .claude directory has any Claude Code resources
                    let has_claude_content = entry.path().join("agents").exists()
                        || entry.path().join("skills").exists()
                        || entry.path().join("commands").exists()
                        || entry.path().join("settings.json").exists()
                        || entry.path().join("settings.local.json").exists();

                    // Also check for CLAUDE.md or .mcp.json in the project root
                    let project_root = entry.path().parent();
                    let has_root_content = project_root.map_or(false, |root| {
                        root.join("CLAUDE.md").exists() || root.join(".mcp.json").exists()
                    });

                    if has_claude_content || has_root_content {
                        if let Some(project_root) = project_root {
                            directories.push(project_root.to_string_lossy().to_string());
                        }
                    }
                }

                // Also check for standalone CLAUDE.md or .mcp.json files (without .claude/ directory)
                if entry.file_type().is_file() {
                    let is_claude_md = file_name == OsStr::new("CLAUDE.md");
                    let is_mcp_json = file_name == OsStr::new(".mcp.json");

                    if is_claude_md || is_mcp_json {
                        if let Some(project_root) = entry.path().parent() {
                            // Only add if this directory doesn't already have a .claude folder
                            // (those are handled above and we don't want duplicates)
                            if !project_root.join(".claude").exists() {
                                // Skip if this is the home directory itself (global CLAUDE.md)
                                let is_home = global_claude_dir
                                    .as_ref()
                                    .and_then(|g| g.parent())
                                    .map_or(false, |home| project_root == home);
                                if !is_home {
                                    directories.push(project_root.to_string_lossy().to_string());
                                }
                            }
                        }
                    }
                }
            }
            Err(err) => {
                if let Some(io_err) = err.io_error() {
                    match io_err.kind() {
                        ErrorKind::PermissionDenied | ErrorKind::TimedOut => continue,
                        _ => {}
                    }
                }
                eprintln!("Skipping directory due to error: {}", err);
                continue;
            }
        }
    }

    directories.sort();
    directories.dedup();
    Ok(directories)
}
