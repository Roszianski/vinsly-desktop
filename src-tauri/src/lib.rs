pub mod scanner;

use scanner::{scan_project_directories, DEFAULT_DISCOVERY_DEPTH};
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
#[cfg(target_os = "macos")]
use std::{env, process::Command};
use tokio::sync::Mutex;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};
use tauri::Manager;

const HOME_DISCOVERY_CACHE_TTL_SECS: u64 = 120;
#[cfg(target_os = "macos")]
const MACOS_BUNDLE_IDENTIFIER: &str = "com.vinsly.desktop";

struct DiscoveryCacheEntry {
    depth: usize,
    include_protected: bool,
    timestamp: Instant,
    directories: Vec<String>,
}

static HOME_DISCOVERY_CACHE: OnceLock<Mutex<Option<DiscoveryCacheEntry>>> = OnceLock::new();
static HOME_DISCOVERY_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();
#[cfg(target_os = "macos")]
static SCAN_HELPER_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();

fn home_discovery_cache() -> &'static Mutex<Option<DiscoveryCacheEntry>> {
    HOME_DISCOVERY_CACHE.get_or_init(|| Mutex::new(None))
}

fn home_discovery_mutex() -> &'static Mutex<()> {
    HOME_DISCOVERY_MUTEX.get_or_init(|| Mutex::new(()))
}

#[cfg(target_os = "macos")]
fn scan_helper_path() -> Option<PathBuf> {
    SCAN_HELPER_PATH
        .get_or_init(|| {
            if let Ok(custom_path) = env::var("VINSLY_SCAN_HELPER_PATH") {
                let candidate = PathBuf::from(custom_path);
                if candidate.exists() {
                    return Some(candidate);
                }
            }

            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(dir) = exe_path.parent() {
                    let default_candidate = dir.join("scan-helper");
                    if default_candidate.exists() {
                        return Some(default_candidate);
                    }

                    let bundle_candidate = dir
                        .join("scan-helper.app")
                        .join("Contents")
                        .join("MacOS")
                        .join("scan-helper");
                    if bundle_candidate.exists() {
                        return Some(bundle_candidate);
                    }
                }
            }

            None
        })
        .clone()
}

async fn get_cached_directories(depth: usize, include_protected: bool) -> Option<Vec<String>> {
    let cache = home_discovery_cache().lock().await;
    match cache.as_ref() {
        Some(entry)
            if entry.depth == depth
                && entry.include_protected == include_protected
                && entry.timestamp.elapsed()
                    < Duration::from_secs(HOME_DISCOVERY_CACHE_TTL_SECS) =>
        {
            Some(entry.directories.clone())
        }
        _ => None,
    }
}

async fn cache_directories(depth: usize, include_protected: bool, directories: &[String]) {
    let mut cache = home_discovery_cache().lock().await;
    *cache = Some(DiscoveryCacheEntry {
        depth,
        include_protected,
        timestamp: Instant::now(),
        directories: directories.to_vec(),
    });
}

#[derive(Debug, Serialize, Deserialize)]
struct AgentFile {
    name: String,
    path: String,
    content: String,
    scope: String, // "project" or "global"
}

#[derive(Debug, Serialize, Deserialize)]
struct SkillFile {
    name: String,
    directory: String,
    path: String,
    content: String,
    scope: String,
    has_assets: bool,
}

fn validate_entry_name(name: &str) -> Result<(), String> {
    if name.trim().is_empty() {
        return Err("Agent name cannot be empty".to_string());
    }
    if name.contains('/') || name.contains('\\') {
        return Err("Agent name cannot contain path separators".to_string());
    }
    if name.contains("..") {
        return Err("Agent name cannot contain '..'".to_string());
    }
    if name.contains('\0') {
        return Err("Agent name contains invalid characters".to_string());
    }
    Ok(())
}

fn ensure_path_in_claude_subdir(path: &Path, subdir: &str) -> Result<(), String> {
    let canonical = fs::canonicalize(path).map_err(|e| format!("Failed to resolve path: {}", e))?;
    // Normalize path separators to forward slashes for cross-platform matching
    // Windows canonicalize() returns backslashes, but we want consistent matching
    let canonical_str = canonical.to_string_lossy().replace('\\', "/");

    // Build the expected pattern (always uses forward slashes)
    let pattern = format!(".claude/{}", subdir);

    // Find the pattern in the path
    if let Some(idx) = canonical_str.find(&pattern) {
        // Verify this is a proper path component boundary (not partial match)
        let before_ok = idx == 0 || canonical_str.as_bytes().get(idx - 1) == Some(&b'/');
        let after_idx = idx + pattern.len();
        let after_ok = after_idx >= canonical_str.len()
            || canonical_str.as_bytes().get(after_idx) == Some(&b'/');

        if before_ok && after_ok {
            // Ensure no path traversal after the subdir (should already be resolved by canonicalize)
            let remaining = &canonical_str[after_idx..];
            if !remaining.contains("..") {
                return Ok(());
            }
        }
    }

    Err(format!(
        "Refusing to modify files outside .claude/{}",
        subdir
    ))
}

fn ensure_path_in_agents_dir(path: &Path) -> Result<(), String> {
    ensure_path_in_claude_subdir(path, "agents")
}

fn ensure_path_in_skills_dir(path: &Path) -> Result<(), String> {
    ensure_path_in_claude_subdir(path, "skills")
}

// Security constants for file operations
const MAX_ARCHIVE_SIZE: u64 = 50 * 1024 * 1024; // 50 MB compressed archive size
const MAX_ARCHIVE_FILES: usize = 1000;
const MAX_SINGLE_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10 MB per extracted file
const MAX_TOTAL_EXTRACTED_SIZE: u64 = 100 * 1024 * 1024; // 100 MB total extracted size (prevents zip bombs)

/// Validates and canonicalizes an input directory path.
/// Rejects relative paths, symlinks, and paths that don't exist.
fn validate_and_canonicalize_directory(dir: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(dir);

    // Reject relative paths
    if !path.is_absolute() {
        return Err("Path must be absolute".to_string());
    }

    // Check path exists before canonicalization
    if !path.exists() {
        return Err(format!("Path does not exist: {}", dir));
    }

    // Check if the path itself is a symlink (before canonicalization)
    let metadata = fs::symlink_metadata(&path)
        .map_err(|e| format!("Cannot read path metadata: {}", e))?;
    if metadata.file_type().is_symlink() {
        return Err("Symlinks are not allowed".to_string());
    }

    // Canonicalize to resolve any ../ components
    let canonical = fs::canonicalize(&path)
        .map_err(|e| format!("Cannot resolve path: {}", e))?;

    // Verify it's a directory
    if !canonical.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    Ok(canonical)
}

/// Validates export destination paths.
/// Rejects system directories and other sensitive locations on all platforms.
fn validate_export_destination(dest: &Path) -> Result<(), String> {
    // Must be absolute
    if !dest.is_absolute() {
        return Err("Destination must be absolute path".to_string());
    }

    let dest_str = dest.to_string_lossy();
    // Normalize to lowercase for case-insensitive Windows path comparison
    let dest_lower = dest_str.to_lowercase();

    // Block Unix system directories
    let unix_forbidden_prefixes = [
        "/etc", "/usr", "/bin", "/sbin", "/var", "/lib",
        "/System", "/Library", "/Applications",
        "/private/etc", "/private/var",
    ];

    for prefix in unix_forbidden_prefixes {
        if dest_str.starts_with(prefix) {
            return Err(format!("Cannot export to system directory: {}", prefix));
        }
    }

    // Block Windows system directories (case-insensitive)
    let windows_forbidden_patterns = [
        "c:\\windows\\",
        "c:\\program files\\",
        "c:\\program files (x86)\\",
        "c:\\programdata\\",
        "c:\\$recycle.bin\\",
        "c:\\system volume information\\",
    ];

    for pattern in windows_forbidden_patterns {
        if dest_lower.starts_with(pattern) || dest_lower.replace('/', "\\").starts_with(pattern) {
            return Err(format!("Cannot export to system directory: {}", pattern));
        }
    }

    Ok(())
}

// Get the .claude/agents directory path based on scope
fn get_agents_dir(scope: &str, project_path: Option<String>) -> Result<PathBuf, String> {
    match scope {
        "project" => {
            // Use provided project path, or return error if none provided
            if let Some(proj_path) = project_path {
                let mut path = PathBuf::from(proj_path);
                path.push(".claude");
                path.push("agents");
                Ok(path)
            } else {
                Err("Project scope requires a project_path parameter".to_string())
            }
        }
        "global" => {
            // Use home directory for global scope
            let home_dir =
                dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
            let mut path = home_dir;
            path.push(".claude");
            path.push("agents");
            Ok(path)
        }
        _ => Err(format!("Invalid scope: {}", scope)),
    }
}

fn get_skills_dir(scope: &str, project_path: Option<String>) -> Result<PathBuf, String> {
    match scope {
        "project" => {
            if let Some(proj_path) = project_path {
                let mut path = PathBuf::from(proj_path);
                path.push(".claude");
                path.push("skills");
                Ok(path)
            } else {
                Err("Project scope requires a project_path parameter".to_string())
            }
        }
        "global" => {
            let home_dir =
                dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
            let mut path = home_dir;
            path.push(".claude");
            path.push("skills");
            Ok(path)
        }
        _ => Err(format!("Invalid scope: {}", scope)),
    }
}

// Get the .claude/commands directory path based on scope
fn get_commands_dir(scope: &str, project_path: Option<String>) -> Result<PathBuf, String> {
    match scope {
        "project" => {
            if let Some(proj_path) = project_path {
                let mut path = PathBuf::from(proj_path);
                path.push(".claude");
                path.push("commands");
                Ok(path)
            } else {
                Err("Project scope requires a project_path parameter".to_string())
            }
        }
        "global" => {
            let home_dir =
                dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
            let mut path = home_dir;
            path.push(".claude");
            path.push("commands");
            Ok(path)
        }
        _ => Err(format!("Invalid scope: {}", scope)),
    }
}

// Get the CLAUDE.md file path based on scope
fn get_claude_memory_path(scope: &str, project_path: Option<String>) -> Result<PathBuf, String> {
    match scope {
        "project" => {
            if let Some(proj_path) = project_path {
                let mut path = PathBuf::from(proj_path);
                path.push(".claude");
                path.push("CLAUDE.md");
                Ok(path)
            } else {
                Err("Project scope requires a project_path parameter".to_string())
            }
        }
        "global" => {
            let home_dir =
                dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
            let mut path = home_dir;
            path.push(".claude");
            path.push("CLAUDE.md");
            Ok(path)
        }
        _ => Err(format!("Invalid scope: {}", scope)),
    }
}

fn ensure_path_in_commands_dir(path: &Path) -> Result<(), String> {
    ensure_path_in_claude_subdir(path, "commands")
}

/// Validates that a path is a valid CLAUDE.md memory file
/// Must be in format: <any>/.claude/CLAUDE.md
/// Uses canonicalization to prevent symlink/traversal attacks
fn ensure_path_is_claude_memory(path: &Path) -> Result<(), String> {
    // First check if it's a symlink (reject before canonicalization)
    if path.is_symlink() {
        return Err("Symlinks are not allowed for memory files".to_string());
    }

    // Canonicalize to resolve any .. or symlinks in parent directories
    let canonical = if path.exists() {
        fs::canonicalize(path).map_err(|e| format!("Failed to resolve path: {}", e))?
    } else {
        // For non-existent paths, canonicalize the parent and append filename
        let parent = path.parent().ok_or("Invalid path: no parent directory")?;
        let filename = path.file_name().ok_or("Invalid path: no filename")?;
        let canonical_parent = fs::canonicalize(parent)
            .map_err(|e| format!("Failed to resolve parent path: {}", e))?;
        canonical_parent.join(filename)
    };

    // Check the canonical path doesn't point to a symlink
    if canonical.is_symlink() {
        return Err("Resolved path is a symlink, which is not allowed".to_string());
    }

    // Normalize path separators for cross-platform matching
    let canonical_str = canonical.to_string_lossy().replace('\\', "/");

    // Must end with .claude/CLAUDE.md
    if !canonical_str.ends_with(".claude/CLAUDE.md") {
        return Err("Path must be a .claude/CLAUDE.md memory file".to_string());
    }

    // Ensure no path traversal - the canonical path should not contain ..
    if canonical_str.contains("..") {
        return Err("Path traversal detected in memory path".to_string());
    }

    Ok(())
}

fn skill_has_additional_assets(dir: &Path) -> bool {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    return true;
                }
                if entry.file_name() != OsStr::new("SKILL.md") {
                    return true;
                }
            }
        }
    }
    false
}

fn build_skill_from_dir(dir: &Path, scope: &str) -> Result<Option<SkillFile>, String> {
    if !dir.is_dir() {
        return Ok(None);
    }
    let skill_file = dir.join("SKILL.md");
    if !skill_file.exists() {
        return Ok(None);
    }

    let content =
        fs::read_to_string(&skill_file).map_err(|e| format!("Failed to read skill file: {}", e))?;
    let name = dir
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Skill directory missing valid name".to_string())?
        .to_string();

    Ok(Some(SkillFile {
        name,
        directory: dir.to_string_lossy().to_string(),
        path: skill_file.to_string_lossy().to_string(),
        content,
        scope: scope.to_string(),
        has_assets: skill_has_additional_assets(dir),
    }))
}

// List all agent files from a directory
#[tauri::command]
async fn list_agents(
    scope: String,
    project_path: Option<String>,
) -> Result<Vec<AgentFile>, String> {
    let agents_dir = get_agents_dir(&scope, project_path)?;

    if !agents_dir.exists() {
        return Ok(Vec::new());
    }

    let mut agents = Vec::new();

    let entries =
        std::fs::read_dir(&agents_dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            agents.push(AgentFile {
                name,
                path: path.to_string_lossy().to_string(),
                content,
                scope: scope.clone(),
            });
        }
    }

    Ok(agents)
}

// Read a single agent file
#[tauri::command]
async fn read_agent(path: String) -> Result<String, String> {
    let expanded_path = expand_path(&path)?;
    ensure_path_in_agents_dir(&expanded_path)?;
    std::fs::read_to_string(&expanded_path).map_err(|e| format!("Failed to read agent file: {}", e))
}

// Write an agent file
#[tauri::command]
async fn write_agent(
    scope: String,
    name: String,
    content: String,
    project_path: Option<String>,
) -> Result<String, String> {
    validate_entry_name(&name)?;
    let agents_dir = get_agents_dir(&scope, project_path)?;

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&agents_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    ensure_path_in_agents_dir(&agents_dir)?;

    let mut file_path = agents_dir;
    file_path.push(format!("{}.md", name));

    std::fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write agent file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

// Expand path to handle ~ (tilde) and relative paths
fn expand_path(path: &str) -> Result<PathBuf, String> {
    if path.starts_with("~/") {
        let home = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
        Ok(home.join(&path[2..]))
    } else if path.starts_with("~") && path.len() == 1 {
        dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())
    } else {
        Ok(PathBuf::from(path))
    }
}

// Delete an agent file
#[tauri::command]
async fn delete_agent(path: String) -> Result<(), String> {
    let expanded_path = expand_path(&path)?;
    ensure_path_in_agents_dir(&expanded_path)?;
    std::fs::remove_file(&expanded_path).map_err(|e| format!("Failed to delete agent file: {}", e))
}

// List agents from an arbitrary directory path
#[tauri::command]
async fn list_agents_from_directory(directory: String) -> Result<Vec<AgentFile>, String> {
    // Validate and canonicalize the input directory
    let canonical_dir = validate_and_canonicalize_directory(&directory)?;

    let mut agents_path = canonical_dir;
    agents_path.push(".claude");
    agents_path.push("agents");

    if !agents_path.exists() {
        return Ok(Vec::new());
    }

    let mut agents = Vec::new();

    let entries =
        std::fs::read_dir(&agents_path).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            agents.push(AgentFile {
                name,
                path: path.to_string_lossy().to_string(),
                content,
                scope: "project".to_string(),
            });
        }
    }

    Ok(agents)
}

#[tauri::command]
async fn list_skills(
    scope: String,
    project_path: Option<String>,
) -> Result<Vec<SkillFile>, String> {
    let skills_dir = get_skills_dir(&scope, project_path)?;
    if !skills_dir.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();
    let entries =
        fs::read_dir(&skills_dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries.flatten() {
        if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            if let Some(skill) = build_skill_from_dir(&entry.path(), &scope)? {
                skills.push(skill);
            }
        }
    }

    Ok(skills)
}

#[tauri::command]
async fn write_skill(
    scope: String,
    name: String,
    content: String,
    project_path: Option<String>,
) -> Result<String, String> {
    validate_entry_name(&name)?;
    let skills_dir = get_skills_dir(&scope, project_path)?;
    fs::create_dir_all(&skills_dir).map_err(|e| format!("Failed to create directory: {}", e))?;
    ensure_path_in_skills_dir(&skills_dir)?;

    let mut skill_dir = skills_dir;
    skill_dir.push(&name);
    fs::create_dir_all(&skill_dir).map_err(|e| format!("Failed to create skill folder: {}", e))?;

    let skill_file = skill_dir.join("SKILL.md");
    fs::write(&skill_file, content).map_err(|e| format!("Failed to write skill: {}", e))?;
    Ok(skill_file.to_string_lossy().to_string())
}

fn resolve_skill_directory(path: &Path) -> Option<PathBuf> {
    if path.is_dir() {
        Some(path.to_path_buf())
    } else {
        path.parent().map(|parent| parent.to_path_buf())
    }
}

#[tauri::command]
async fn delete_skill(path: String) -> Result<(), String> {
    let expanded_path = expand_path(&path)?;
    let Some(directory) = resolve_skill_directory(&expanded_path) else {
        return Err("Unable to resolve skill directory".to_string());
    };
    ensure_path_in_skills_dir(&directory)?;
    if directory.exists() {
        fs::remove_dir_all(&directory)
            .map_err(|e| format!("Failed to delete skill folder: {}", e))?;
    }
    Ok(())
}

/// Recursively copies all contents from src to dst directory
fn copy_dir_contents(src: &Path, dst: &Path) -> Result<(), String> {
    if !dst.exists() {
        fs::create_dir_all(dst).map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let entries = fs::read_dir(src).map_err(|e| format!("Failed to read source directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            copy_dir_contents(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

#[tauri::command]
async fn migrate_skill(
    old_path: String,
    scope: String,
    name: String,
    content: String,
    project_path: Option<String>,
) -> Result<String, String> {
    validate_entry_name(&name)?;

    // Resolve and validate old directory
    let old_expanded = expand_path(&old_path)?;
    let old_dir = resolve_skill_directory(&old_expanded)
        .ok_or_else(|| "Unable to resolve old skill directory".to_string())?;
    ensure_path_in_skills_dir(&old_dir)?;

    // Get new skill directory path
    let skills_dir = get_skills_dir(&scope, project_path)?;
    fs::create_dir_all(&skills_dir).map_err(|e| format!("Failed to create directory: {}", e))?;
    ensure_path_in_skills_dir(&skills_dir)?;

    let mut new_dir = skills_dir;
    new_dir.push(&name);

    // If old and new are the same, just write the content
    if old_dir == new_dir {
        let skill_file = new_dir.join("SKILL.md");
        fs::write(&skill_file, content).map_err(|e| format!("Failed to write skill: {}", e))?;
        return Ok(skill_file.to_string_lossy().to_string());
    }

    // Create new directory
    fs::create_dir_all(&new_dir).map_err(|e| format!("Failed to create skill folder: {}", e))?;

    // Copy all contents from old directory to new (preserving assets)
    if old_dir.exists() {
        let entries = fs::read_dir(&old_dir)
            .map_err(|e| format!("Failed to read old skill directory: {}", e))?;

        for entry in entries {
            let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
            let src_path = entry.path();
            let file_name = entry.file_name();

            // Skip SKILL.md - we'll write fresh content
            if file_name == OsStr::new("SKILL.md") {
                continue;
            }

            let dst_path = new_dir.join(&file_name);

            if src_path.is_dir() {
                copy_dir_contents(&src_path, &dst_path)?;
            } else {
                fs::copy(&src_path, &dst_path)
                    .map_err(|e| format!("Failed to copy file: {}", e))?;
            }
        }

        // Delete old directory after successful copy
        fs::remove_dir_all(&old_dir)
            .map_err(|e| format!("Failed to remove old skill folder: {}", e))?;
    }

    // Write new SKILL.md content
    let skill_file = new_dir.join("SKILL.md");
    fs::write(&skill_file, content).map_err(|e| format!("Failed to write skill: {}", e))?;

    Ok(skill_file.to_string_lossy().to_string())
}

#[tauri::command]
async fn list_skills_from_directory(directory: String) -> Result<Vec<SkillFile>, String> {
    // Validate and canonicalize the input directory
    let canonical_dir = validate_and_canonicalize_directory(&directory)?;

    let mut skills_path = canonical_dir;
    skills_path.push(".claude");
    skills_path.push("skills");

    if !skills_path.exists() {
        return Ok(Vec::new());
    }

    let mut skills = Vec::new();
    let entries =
        fs::read_dir(&skills_path).map_err(|e| format!("Failed to read directory: {}", e))?;
    for entry in entries.flatten() {
        if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
            if let Some(skill) = build_skill_from_dir(&entry.path(), "project")? {
                skills.push(skill);
            }
        }
    }

    Ok(skills)
}

fn zip_skill_directory(source_dir: &Path, destination: &Path) -> Result<(), String> {
    let Some(parent) = source_dir.parent() else {
        return Err("Invalid skill directory".to_string());
    };

    let file =
        fs::File::create(destination).map_err(|e| format!("Failed to create archive: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    for entry in WalkDir::new(source_dir) {
        let entry = entry.map_err(|e| format!("Failed to walk directory: {}", e))?;
        let path = entry.path();
        let relative = path
            .strip_prefix(parent)
            .map_err(|e| format!("Failed to compute relative path: {}", e))?;
        let name = relative.to_string_lossy().replace('\\', "/");

        if entry.file_type().is_dir() {
            zip.add_directory(name, options)
                .map_err(|e| format!("Failed to add directory to archive: {}", e))?;
        } else {
            zip.start_file(name, options)
                .map_err(|e| format!("Failed to add file to archive: {}", e))?;
            let mut file =
                fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file: {}", e))?;
            zip.write_all(&buffer)
                .map_err(|e| format!("Failed to write to archive: {}", e))?;
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalise archive: {}", e))?;
    Ok(())
}

fn next_available_skill_directory(base: &Path, desired: &str) -> PathBuf {
    let mut candidate = base.join(desired);
    if !candidate.exists() {
        return candidate;
    }

    let mut counter = 1;
    loop {
        let name = format!("{}-{}", desired, counter);
        candidate = base.join(&name);
        if !candidate.exists() {
            return candidate;
        }
        counter += 1;
    }
}

fn extract_skill_archive(archive_path: &Path, base: &Path) -> Result<PathBuf, String> {
    // Check archive file size
    let archive_metadata = fs::metadata(archive_path)
        .map_err(|e| format!("Failed to read archive metadata: {}", e))?;
    if archive_metadata.len() > MAX_ARCHIVE_SIZE {
        return Err(format!(
            "Archive too large: {} bytes (max {} bytes)",
            archive_metadata.len(),
            MAX_ARCHIVE_SIZE
        ));
    }

    let file =
        fs::File::open(archive_path).map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read archive: {}", e))?;

    // Check file count limit
    if archive.len() > MAX_ARCHIVE_FILES {
        return Err(format!(
            "Archive contains too many files: {} (max {})",
            archive.len(),
            MAX_ARCHIVE_FILES
        ));
    }

    let mut root_name: Option<String> = None;
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to inspect archive entry: {}", e))?;
        if let Some(enclosed) = entry.enclosed_name() {
            if let Some(Component::Normal(part)) = enclosed.components().next() {
                let part_str = part.to_string_lossy().to_string();
                if part_str.starts_with("__MACOSX") {
                    continue;
                }
                match &root_name {
                    Some(existing) if existing != &part_str => {
                        return Err(
                            "Archive must contain a single root folder (zip the skill directory)"
                                .to_string(),
                        )
                    }
                    None => root_name = Some(part_str),
                    _ => {}
                }
            }
        } else {
            return Err("Archive contains invalid paths".to_string());
        }
    }

    let Some(root) = root_name else {
        return Err("Archive missing skill folder".to_string());
    };

    let target_dir = next_available_skill_directory(base, &root);
    fs::create_dir_all(&target_dir)
        .map_err(|e| format!("Failed to create skill directory: {}", e))?;

    // Track cumulative extracted size to prevent zip bombs
    let mut total_extracted_size: u64 = 0;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to extract archive entry: {}", e))?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };

        let mut components = enclosed.components();
        let Some(Component::Normal(root_component)) = components.next() else {
            continue;
        };
        let root_component_str = root_component.to_string_lossy();
        if root_component_str.starts_with("__MACOSX") {
            continue;
        }
        let relative_path: PathBuf = components.collect();
        let output_path = if relative_path.as_os_str().is_empty() {
            target_dir.clone()
        } else {
            target_dir.join(&relative_path)
        };

        // Security check: ensure extracted path stays within target directory
        // Use lexical check first (before creating the file)
        let output_str = output_path.to_string_lossy();
        let target_str = target_dir.to_string_lossy();
        if !output_str.starts_with(target_str.as_ref()) {
            return Err(format!(
                "Archive contains path that escapes target directory: {:?}",
                relative_path
            ));
        }

        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            // Check individual file size before extraction
            let file_size = entry.size();
            if file_size > MAX_SINGLE_FILE_SIZE {
                let _ = fs::remove_dir_all(&target_dir);
                return Err(format!(
                    "File too large: {} bytes (max {} bytes)",
                    file_size,
                    MAX_SINGLE_FILE_SIZE
                ));
            }

            // Check cumulative extracted size
            total_extracted_size += file_size;
            if total_extracted_size > MAX_TOTAL_EXTRACTED_SIZE {
                let _ = fs::remove_dir_all(&target_dir);
                return Err(format!(
                    "Total extracted size exceeds limit: {} bytes (max {} bytes)",
                    total_extracted_size,
                    MAX_TOTAL_EXTRACTED_SIZE
                ));
            }

            if let Some(parent) = output_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            let mut file = fs::File::create(&output_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut entry, &mut file)
                .map_err(|e| format!("Failed to write file: {}", e))?;
        }
    }

    let skill_manifest = target_dir.join("SKILL.md");
    if !skill_manifest.exists() {
        let _ = fs::remove_dir_all(&target_dir);
        return Err("Imported archive did not contain SKILL.md".to_string());
    }

    Ok(target_dir)
}

#[tauri::command]
async fn export_skill_directory(directory: String, destination: String) -> Result<(), String> {
    let expanded_directory = expand_path(&directory)?;
    ensure_path_in_skills_dir(&expanded_directory)?;
    if !expanded_directory.exists() {
        return Err("Skill directory does not exist".to_string());
    }

    let destination_path = PathBuf::from(&destination);

    // Validate export destination
    validate_export_destination(&destination_path)?;

    if let Some(parent) = destination_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to prepare destination: {}", e))?;
        }
    }

    zip_skill_directory(&expanded_directory, &destination_path)?;
    Ok(())
}

#[tauri::command]
async fn import_skill_archive(
    archive_path: String,
    scope: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let expanded_archive = expand_path(&archive_path)?;
    if !expanded_archive.exists() {
        return Err("Archive does not exist".to_string());
    }

    let skills_dir = get_skills_dir(&scope, project_path)?;
    fs::create_dir_all(&skills_dir)
        .map_err(|e| format!("Failed to prepare skills directory: {}", e))?;
    ensure_path_in_skills_dir(&skills_dir)?;

    let target_dir = extract_skill_archive(&expanded_archive, &skills_dir)?;
    Ok(target_dir.to_string_lossy().to_string())
}

#[tauri::command]
async fn export_skills_archive(directories: Vec<String>, destination: String) -> Result<(), String> {
    if directories.is_empty() {
        return Err("No skill directories provided".to_string());
    }

    let destination_path = PathBuf::from(&destination);

    // Validate export destination
    validate_export_destination(&destination_path)?;

    if let Some(parent) = destination_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to prepare destination: {}", e))?;
        }
    }

    let file =
        fs::File::create(&destination_path).map_err(|e| format!("Failed to create archive: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    for directory in directories {
        let expanded = expand_path(&directory)?;
        if !expanded.exists() {
            continue;
        }
        ensure_path_in_skills_dir(&expanded)?;
        let root_name = expanded
            .file_name()
            .and_then(|s| s.to_str())
            .ok_or_else(|| "Skill directory missing valid name".to_string())?;

        for entry in WalkDir::new(&expanded) {
            let entry = entry.map_err(|e| format!("Failed to walk directory: {}", e))?;
            let path = entry.path();
            let relative = path
                .strip_prefix(&expanded)
                .map_err(|e| format!("Failed to compute relative path: {}", e))?;
            let mut archive_path = PathBuf::from(root_name);
            if !relative.as_os_str().is_empty() {
                archive_path = archive_path.join(relative);
            }
            let archive_name = archive_path.to_string_lossy().replace('\\', "/");

            if entry.file_type().is_dir() {
                zip.add_directory(archive_name, options)
                    .map_err(|e| format!("Failed to add directory: {}", e))?;
            } else {
                zip.start_file(archive_name, options)
                    .map_err(|e| format!("Failed to add file: {}", e))?;
                let mut file =
                    fs::File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
                let mut buffer = Vec::new();
                file.read_to_end(&mut buffer)
                    .map_err(|e| format!("Failed to read file: {}", e))?;
                zip.write_all(&buffer)
                    .map_err(|e| format!("Failed to write to archive: {}", e))?;
            }
        }
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalise archive: {}", e))?;
    Ok(())
}

// Get cross-platform home directory
#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())
        .map(|p| p.to_string_lossy().to_string())
}

#[cfg(target_os = "macos")]
async fn perform_directory_scan(
    depth: usize,
    include_protected: bool,
) -> Result<Vec<String>, String> {
    if include_protected {
        match run_scan_helper(depth, include_protected).await {
            Ok(result) => return Ok(result),
            Err(_) => {
                // Silently fall back to inline scanner if scan-helper fails.
                // This is expected behavior when FDA permissions aren't granted.
            }
        }
    }

    run_inline_scan(depth, include_protected).await
}

#[cfg(not(target_os = "macos"))]
async fn perform_directory_scan(
    depth: usize,
    include_protected: bool,
) -> Result<Vec<String>, String> {
    run_inline_scan(depth, include_protected).await
}

async fn run_inline_scan(depth: usize, include_protected: bool) -> Result<Vec<String>, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
    let include_protected_for_task = include_protected;

    tauri::async_runtime::spawn_blocking(move || {
        scan_project_directories(home_dir, depth, include_protected_for_task)
    })
    .await
    .map_err(|err| format!("Failed to join home discovery task: {}", err))?
}

#[cfg(target_os = "macos")]
async fn run_scan_helper(depth: usize, include_protected: bool) -> Result<Vec<String>, String> {
    let helper_path = scan_helper_path()
        .ok_or_else(|| "scan-helper binary not found next to the Vinsly executable".to_string())?;
    let helper_label = helper_path.display().to_string();
    let depth_arg = depth.to_string();

    let helper_result = tauri::async_runtime::spawn_blocking(move || {
        let mut cmd = Command::new(&helper_path);
        cmd.arg("--depth").arg(&depth_arg);
        if include_protected {
            cmd.arg("--include-protected");
        }
        cmd.output()
            .map_err(|err| format!("Failed to launch {}: {}", helper_label, err))
    })
    .await
    .map_err(|err| format!("Failed to join scan-helper task: {}", err))?;

    let output = helper_result?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "scan-helper exited with status {} ({})",
            output.status,
            stderr.trim()
        ));
    }

    serde_json::from_slice::<Vec<String>>(&output.stdout)
        .map_err(|err| format!("scan-helper returned invalid JSON: {}", err))
}

#[tauri::command]
async fn discover_project_directories(
    max_depth: Option<usize>,
    include_protected_dirs: Option<bool>,
) -> Result<Vec<String>, String> {
    let depth = max_depth.unwrap_or(DEFAULT_DISCOVERY_DEPTH).max(1);
    let include_protected = include_protected_dirs.unwrap_or(false);

    if let Some(cached) = get_cached_directories(depth, include_protected).await {
        return Ok(cached);
    }

    let _guard = home_discovery_mutex().lock().await;

    if let Some(cached) = get_cached_directories(depth, include_protected).await {
        return Ok(cached);
    }

    let directories = perform_directory_scan(depth, include_protected).await?;
    cache_directories(depth, include_protected, &directories).await;
    Ok(directories)
}

#[tauri::command]
fn check_full_disk_access() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        log_tcc_full_disk_status();

        // Clear the home discovery cache so next scan picks up any permission changes
        tauri::async_runtime::block_on(async {
            let mut cache = home_discovery_cache().lock().await;
            *cache = None;
        });

        // Only check TCC.db - never attempt to read protected directories directly
        // as that triggers macOS permission prompts for Music, Documents, Desktop, etc.
        match query_tcc_full_disk_entry()? {
            Some(allowed) => Ok(allowed),
            None => Ok(false), // No TCC entry means FDA not granted
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[cfg(target_os = "macos")]
fn log_tcc_full_disk_status() {
    // Query TCC status silently - no production logging needed.
    // The status is used internally but not displayed to users.
    let _ = query_tcc_full_disk_entry();
}

#[cfg(target_os = "macos")]
fn query_tcc_full_disk_entry() -> Result<Option<bool>, String> {
    let home_dir = dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
    let db_path = home_dir
        .join("Library")
        .join("Application Support")
        .join("com.apple.TCC")
        .join("TCC.db");

    if !db_path.exists() {
        return Ok(None);
    }

    let allowed_column_exists = tcc_access_has_allowed_column(&db_path)?;
    // macOS 14+ record Full Disk Access decisions via auth_value. On Ventura through Tahaeo betas,
    // grants show up as auth_value>=2 while the legacy "allowed" column may stay at 0 or be removed.
    // Prefer auth_value everywhere but still honor the column on older releases if present.
    //
    // SAFETY: MACOS_BUNDLE_IDENTIFIER is a compile-time constant ("com.vinsly.desktop").
    // String interpolation is safe here as no user input is involved. We use sqlite3 CLI
    // which doesn't support parameterized queries - this pattern is intentional.
    let grant_query = if allowed_column_exists {
        format!(
            "SELECT CASE WHEN auth_value >= 2 OR allowed = 1 THEN 1 ELSE 0 END AS granted \
            FROM access WHERE client='{}' AND service='kTCCServiceSystemPolicyAllFiles' \
            ORDER BY last_modified DESC LIMIT 1;",
            MACOS_BUNDLE_IDENTIFIER
        )
    } else {
        format!(
            "SELECT CASE WHEN auth_value >= 2 THEN 1 ELSE 0 END AS granted \
            FROM access WHERE client='{}' AND service='kTCCServiceSystemPolicyAllFiles' \
            ORDER BY last_modified DESC LIMIT 1;",
            MACOS_BUNDLE_IDENTIFIER
        )
    };

    let stdout = run_sqlite_query(&db_path, &grant_query)?;
    if stdout.is_empty() {
        return Ok(None);
    }

    let granted: i64 = stdout
        .parse()
        .map_err(|err| format!("Unexpected sqlite3 output '{}': {}", stdout, err))?;
    Ok(Some(granted == 1))
}

#[cfg(target_os = "macos")]
fn run_sqlite_query(db_path: &Path, query: &str) -> Result<String, String> {
    let output = Command::new("/usr/bin/sqlite3")
        .arg(db_path)
        .arg(query)
        .output()
        .map_err(|err| format!("Failed to invoke sqlite3 on {}: {}", db_path.display(), err))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!(
            "sqlite3 exited with status {} ({})",
            output.status,
            stderr.trim()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(target_os = "macos")]
fn tcc_access_has_allowed_column(db_path: &Path) -> Result<bool, String> {
    let pragma_output = run_sqlite_query(db_path, "PRAGMA table_info(access);")?;
    Ok(pragma_output
        .lines()
        .filter_map(|line| line.split('|').nth(1))
        .any(|column| column == "allowed"))
}

// ============================================================================
// CLAUDE.md (Memory) Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeMemoryFile {
    scope: String,
    path: String,
    content: String,
    exists: bool,
}

#[tauri::command]
async fn read_claude_memory(
    scope: String,
    project_path: Option<String>,
) -> Result<ClaudeMemoryFile, String> {
    let memory_path = get_claude_memory_path(&scope, project_path)?;

    if memory_path.exists() {
        let content = fs::read_to_string(&memory_path)
            .map_err(|e| format!("Failed to read CLAUDE.md: {}", e))?;
        Ok(ClaudeMemoryFile {
            scope,
            path: memory_path.to_string_lossy().to_string(),
            content,
            exists: true,
        })
    } else {
        Ok(ClaudeMemoryFile {
            scope,
            path: memory_path.to_string_lossy().to_string(),
            content: String::new(),
            exists: false,
        })
    }
}

#[tauri::command]
async fn write_claude_memory(
    scope: String,
    content: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let memory_path = get_claude_memory_path(&scope, project_path)?;

    // Create parent .claude directory if it doesn't exist
    if let Some(parent) = memory_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
    }

    fs::write(&memory_path, content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    Ok(memory_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn check_claude_memory_exists(
    scope: String,
    project_path: Option<String>,
) -> Result<bool, String> {
    let memory_path = get_claude_memory_path(&scope, project_path)?;
    Ok(memory_path.exists())
}

// ============================================================================
// Slash Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct SlashCommandFile {
    name: String,
    path: String,
    content: String,
    scope: String,
}

#[tauri::command]
async fn list_slash_commands(
    scope: String,
    project_path: Option<String>,
) -> Result<Vec<SlashCommandFile>, String> {
    let commands_dir = get_commands_dir(&scope, project_path)?;

    if !commands_dir.exists() {
        return Ok(Vec::new());
    }

    let mut commands = Vec::new();

    let entries = fs::read_dir(&commands_dir)
        .map_err(|e| format!("Failed to read commands directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read command file: {}", e))?;

            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            commands.push(SlashCommandFile {
                name,
                path: path.to_string_lossy().to_string(),
                content,
                scope: scope.clone(),
            });
        }
    }

    Ok(commands)
}

#[tauri::command]
async fn read_slash_command(path: String) -> Result<String, String> {
    let expanded_path = expand_path(&path)?;
    ensure_path_in_commands_dir(&expanded_path)?;
    fs::read_to_string(&expanded_path)
        .map_err(|e| format!("Failed to read command file: {}", e))
}

#[tauri::command]
async fn write_slash_command(
    scope: String,
    name: String,
    content: String,
    project_path: Option<String>,
) -> Result<String, String> {
    validate_entry_name(&name)?;
    let commands_dir = get_commands_dir(&scope, project_path)?;

    // Create directory if it doesn't exist
    fs::create_dir_all(&commands_dir)
        .map_err(|e| format!("Failed to create commands directory: {}", e))?;
    ensure_path_in_commands_dir(&commands_dir)?;

    let mut file_path = commands_dir;
    file_path.push(format!("{}.md", name));

    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write command file: {}", e))?;

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn delete_slash_command(path: String) -> Result<(), String> {
    let expanded_path = expand_path(&path)?;
    ensure_path_in_commands_dir(&expanded_path)?;
    fs::remove_file(&expanded_path)
        .map_err(|e| format!("Failed to delete command file: {}", e))
}

#[tauri::command]
async fn list_slash_commands_from_directory(directory: String) -> Result<Vec<SlashCommandFile>, String> {
    // Validate and canonicalize the input directory
    let canonical_dir = validate_and_canonicalize_directory(&directory)?;

    let mut commands_path = canonical_dir;
    commands_path.push(".claude");
    commands_path.push("commands");

    if !commands_path.exists() {
        return Ok(Vec::new());
    }

    let mut commands = Vec::new();

    let entries = fs::read_dir(&commands_path)
        .map_err(|e| format!("Failed to read commands directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read command file: {}", e))?;

            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_string();

            commands.push(SlashCommandFile {
                name,
                path: path.to_string_lossy().to_string(),
                content,
                scope: "project".to_string(),
            });
        }
    }

    Ok(commands)
}

// Export slash commands to a zip archive
#[tauri::command]
async fn export_slash_commands_archive(paths: Vec<String>, destination: String) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No command files provided".to_string());
    }

    let destination_path = PathBuf::from(&destination);

    // Validate export destination
    validate_export_destination(&destination_path)?;

    if let Some(parent) = destination_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to prepare destination: {}", e))?;
        }
    }

    let file = fs::File::create(&destination_path)
        .map_err(|e| format!("Failed to create archive: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    for path_str in paths {
        let path = expand_path(&path_str)?;
        if !path.exists() {
            continue;
        }
        ensure_path_in_commands_dir(&path)?;

        let file_name = path
            .file_name()
            .and_then(|s| s.to_str())
            .ok_or_else(|| "Command file missing valid name".to_string())?;

        zip.start_file(file_name, options)
            .map_err(|e| format!("Failed to add file to archive: {}", e))?;
        let content = fs::read(&path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        zip.write_all(&content)
            .map_err(|e| format!("Failed to write to archive: {}", e))?;
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalise archive: {}", e))?;
    Ok(())
}

// Import slash commands from a zip archive
#[tauri::command]
async fn import_slash_commands_archive(
    archive_path: String,
    scope: String,
    project_path: Option<String>,
) -> Result<Vec<String>, String> {
    let expanded_archive = expand_path(&archive_path)?;
    if !expanded_archive.exists() {
        return Err("Archive does not exist".to_string());
    }

    // Check archive file size to prevent zip bombs
    let archive_metadata = fs::metadata(&expanded_archive)
        .map_err(|e| format!("Failed to read archive metadata: {}", e))?;
    if archive_metadata.len() > MAX_ARCHIVE_SIZE {
        return Err(format!(
            "Archive too large: {} bytes (max {} bytes)",
            archive_metadata.len(),
            MAX_ARCHIVE_SIZE
        ));
    }

    let commands_dir = get_commands_dir(&scope, project_path)?;
    fs::create_dir_all(&commands_dir)
        .map_err(|e| format!("Failed to prepare commands directory: {}", e))?;
    ensure_path_in_commands_dir(&commands_dir)?;

    let file = fs::File::open(&expanded_archive)
        .map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    // Check file count limit to prevent resource exhaustion
    if archive.len() > MAX_ARCHIVE_FILES {
        return Err(format!(
            "Archive contains too many files: {} (max {})",
            archive.len(),
            MAX_ARCHIVE_FILES
        ));
    }

    let mut imported_paths = Vec::new();

    // Track cumulative extracted size to prevent zip bombs
    let mut total_extracted_size: u64 = 0;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };

        // Skip directories and non-.md files
        if entry.is_dir() {
            continue;
        }

        let file_name = enclosed
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        if !file_name.ends_with(".md") || file_name.starts_with("__MACOSX") || file_name.starts_with('.') {
            continue;
        }

        // Check individual file size before extraction
        let file_size = entry.size();
        if file_size > MAX_SINGLE_FILE_SIZE {
            return Err(format!(
                "File '{}' too large: {} bytes (max {} bytes)",
                file_name,
                file_size,
                MAX_SINGLE_FILE_SIZE
            ));
        }

        // Check cumulative extracted size
        total_extracted_size += file_size;
        if total_extracted_size > MAX_TOTAL_EXTRACTED_SIZE {
            return Err(format!(
                "Total extracted size exceeds limit: {} bytes (max {} bytes)",
                total_extracted_size,
                MAX_TOTAL_EXTRACTED_SIZE
            ));
        }

        let output_path = commands_dir.join(file_name);

        let mut content = Vec::new();
        entry.read_to_end(&mut content)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        fs::write(&output_path, content)
            .map_err(|e| format!("Failed to write command file: {}", e))?;

        imported_paths.push(output_path.to_string_lossy().to_string());
    }

    if imported_paths.is_empty() {
        return Err("Archive did not contain any .md command files".to_string());
    }

    Ok(imported_paths)
}

// Export CLAUDE.md memory files to a zip archive
#[tauri::command]
async fn export_memories_archive(paths: Vec<String>, destination: String) -> Result<(), String> {
    if paths.is_empty() {
        return Err("No memory files provided".to_string());
    }

    let destination_path = PathBuf::from(&destination);

    // Validate export destination
    validate_export_destination(&destination_path)?;

    if let Some(parent) = destination_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to prepare destination: {}", e))?;
        }
    }

    let file = fs::File::create(&destination_path)
        .map_err(|e| format!("Failed to create archive: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = FileOptions::default().compression_method(CompressionMethod::Deflated);

    for (index, path_str) in paths.iter().enumerate() {
        let path = expand_path(path_str)?;

        // Security: Validate this is a legitimate .claude/CLAUDE.md path
        ensure_path_is_claude_memory(&path)?;

        if !path.exists() {
            continue;
        }

        // Extract a meaningful name for the archive entry
        // For global: "global-CLAUDE.md"
        // For project: "projectname-CLAUDE.md"
        let archive_name = if path_str.contains("/.claude/CLAUDE.md") {
            // Get the parent folder name (project name or home indicator)
            let parent_of_claude = path.parent().and_then(|p| p.parent());
            if let Some(parent) = parent_of_claude {
                let folder_name = parent
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown");
                // Check if this is the home directory (global memory)
                let home_dir = dirs::home_dir();
                if home_dir.as_ref() == Some(&parent.to_path_buf()) {
                    "global-CLAUDE.md".to_string()
                } else {
                    format!("{}-CLAUDE.md", folder_name)
                }
            } else {
                format!("memory-{}-CLAUDE.md", index)
            }
        } else {
            format!("memory-{}-CLAUDE.md", index)
        };

        zip.start_file(&archive_name, options)
            .map_err(|e| format!("Failed to add file to archive: {}", e))?;
        let content = fs::read(&path)
            .map_err(|e| format!("Failed to read file: {}", e))?;
        zip.write_all(&content)
            .map_err(|e| format!("Failed to write to archive: {}", e))?;
    }

    zip.finish()
        .map_err(|e| format!("Failed to finalise archive: {}", e))?;
    Ok(())
}

// Import CLAUDE.md memory files from a zip archive
// This imports to the global .claude/CLAUDE.md by default, or to a specific project
#[tauri::command]
async fn import_memories_archive(
    archive_path: String,
    scope: String,
    project_path: Option<String>,
) -> Result<Vec<String>, String> {
    let expanded_archive = expand_path(&archive_path)?;
    if !expanded_archive.exists() {
        return Err("Archive does not exist".to_string());
    }

    // Check archive file size to prevent zip bombs
    let archive_metadata = fs::metadata(&expanded_archive)
        .map_err(|e| format!("Failed to read archive metadata: {}", e))?;
    if archive_metadata.len() > MAX_ARCHIVE_SIZE {
        return Err(format!(
            "Archive too large: {} bytes (max {} bytes)",
            archive_metadata.len(),
            MAX_ARCHIVE_SIZE
        ));
    }

    let file = fs::File::open(&expanded_archive)
        .map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive = ZipArchive::new(file)
        .map_err(|e| format!("Failed to read archive: {}", e))?;

    // Check file count limit to prevent resource exhaustion
    if archive.len() > MAX_ARCHIVE_FILES {
        return Err(format!(
            "Archive contains too many files: {} (max {})",
            archive.len(),
            MAX_ARCHIVE_FILES
        ));
    }

    let mut imported_paths = Vec::new();

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };

        // Skip directories
        if entry.is_dir() {
            continue;
        }

        let file_name = enclosed
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("");

        // Only process files that look like CLAUDE.md files
        if !file_name.ends_with("CLAUDE.md") || file_name.starts_with("__MACOSX") || file_name.starts_with('.') {
            continue;
        }

        let mut content = Vec::new();
        entry.read_to_end(&mut content)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        // Determine the target path based on scope
        let memory_path = get_claude_memory_path(&scope, project_path.clone())?;

        // Create parent .claude directory if it doesn't exist
        if let Some(parent) = memory_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create .claude directory: {}", e))?;
        }

        // If importing multiple memories, we can only import one per scope
        // So we'll merge content if there are multiple CLAUDE.md files
        if memory_path.exists() && !imported_paths.is_empty() {
            // Append to existing content
            let existing = fs::read_to_string(&memory_path)
                .map_err(|e| format!("Failed to read existing memory: {}", e))?;
            let new_content = String::from_utf8_lossy(&content);
            let merged = format!("{}\n\n---\n\n{}", existing, new_content);
            fs::write(&memory_path, merged)
                .map_err(|e| format!("Failed to write memory file: {}", e))?;
        } else {
            fs::write(&memory_path, content)
                .map_err(|e| format!("Failed to write memory file: {}", e))?;
        }

        if !imported_paths.contains(&memory_path.to_string_lossy().to_string()) {
            imported_paths.push(memory_path.to_string_lossy().to_string());
        }
    }

    if imported_paths.is_empty() {
        return Err("Archive did not contain any CLAUDE.md memory files".to_string());
    }

    Ok(imported_paths)
}

// ============================================================================
// MCP Server Configuration Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MCPServerConfig {
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    server_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    command: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    args: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    headers: Option<std::collections::HashMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    env: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct MCPConfigFile {
    #[serde(rename = "mcpServers", default)]
    mcp_servers: std::collections::HashMap<String, MCPServerConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MCPServerInfo {
    name: String,
    server_type: String,
    url: Option<String>,
    command: Option<String>,
    args: Option<Vec<String>>,
    headers: Option<std::collections::HashMap<String, String>>,
    env: Option<std::collections::HashMap<String, String>>,
    scope: String,
    source_path: String,
    enabled: bool,
}

fn get_mcp_config_path(scope: &str, project_path: Option<String>) -> Result<PathBuf, String> {
    match scope {
        "user" => {
            let home_dir =
                dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
            Ok(home_dir.join(".claude").join("mcp.json"))
        }
        "project" => {
            if let Some(proj_path) = project_path {
                Ok(PathBuf::from(proj_path).join(".mcp.json"))
            } else {
                Err("Project scope requires a project_path parameter".to_string())
            }
        }
        "local" => {
            if let Some(proj_path) = project_path {
                Ok(PathBuf::from(proj_path)
                    .join(".claude")
                    .join("settings.local.json"))
            } else {
                let home_dir =
                    dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
                Ok(home_dir.join(".claude").join("settings.local.json"))
            }
        }
        _ => Err(format!("Invalid MCP scope: {}", scope)),
    }
}

fn read_mcp_config_from_file(path: &Path) -> Result<MCPConfigFile, String> {
    if !path.exists() {
        return Ok(MCPConfigFile::default());
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read MCP config file: {}", e))?;

    if content.trim().is_empty() {
        return Ok(MCPConfigFile::default());
    }

    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse MCP config: {}", e))
}

fn write_mcp_config_to_file(path: &Path, config: &MCPConfigFile) -> Result<(), String> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    let content = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize MCP config: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("Failed to write MCP config file: {}", e))?;

    Ok(())
}

fn infer_server_type(config: &MCPServerConfig) -> String {
    if let Some(ref t) = config.server_type {
        return t.clone();
    }
    if config.command.is_some() {
        return "stdio".to_string();
    }
    "http".to_string()
}

#[tauri::command]
async fn list_mcp_servers(project_path: Option<String>) -> Result<Vec<MCPServerInfo>, String> {
    let mut servers = Vec::new();

    // Read user-level config (~/.claude/mcp.json)
    let user_path = get_mcp_config_path("user", None)?;
    if let Ok(config) = read_mcp_config_from_file(&user_path) {
        for (name, server_config) in config.mcp_servers {
            servers.push(MCPServerInfo {
                name: name.clone(),
                server_type: infer_server_type(&server_config),
                url: server_config.url,
                command: server_config.command,
                args: server_config.args,
                headers: server_config.headers,
                env: server_config.env,
                scope: "user".to_string(),
                source_path: user_path.to_string_lossy().to_string(),
                enabled: true,
            });
        }
    }

    // Read project-level config (.mcp.json) if project_path provided
    if let Some(ref proj_path) = project_path {
        let project_config_path = get_mcp_config_path("project", Some(proj_path.clone()))?;
        if let Ok(config) = read_mcp_config_from_file(&project_config_path) {
            for (name, server_config) in config.mcp_servers {
                servers.push(MCPServerInfo {
                    name: name.clone(),
                    server_type: infer_server_type(&server_config),
                    url: server_config.url,
                    command: server_config.command,
                    args: server_config.args,
                    headers: server_config.headers,
                    env: server_config.env,
                    scope: "project".to_string(),
                    source_path: project_config_path.to_string_lossy().to_string(),
                    enabled: true,
                });
            }
        }
    }

    Ok(servers)
}

#[tauri::command]
async fn read_mcp_config(
    scope: String,
    project_path: Option<String>,
) -> Result<MCPConfigFile, String> {
    let config_path = get_mcp_config_path(&scope, project_path)?;
    read_mcp_config_from_file(&config_path)
}

#[tauri::command]
async fn write_mcp_config(
    scope: String,
    config: MCPConfigFile,
    project_path: Option<String>,
) -> Result<String, String> {
    let config_path = get_mcp_config_path(&scope, project_path)?;
    write_mcp_config_to_file(&config_path, &config)?;
    Ok(config_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn add_mcp_server(
    scope: String,
    name: String,
    server_config: MCPServerConfig,
    project_path: Option<String>,
) -> Result<String, String> {
    // Validate server name
    if name.trim().is_empty() {
        return Err("Server name cannot be empty".to_string());
    }

    let config_path = get_mcp_config_path(&scope, project_path)?;
    let mut config = read_mcp_config_from_file(&config_path)?;

    // Add the new server
    config.mcp_servers.insert(name, server_config);

    write_mcp_config_to_file(&config_path, &config)?;
    Ok(config_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn remove_mcp_server(
    scope: String,
    name: String,
    project_path: Option<String>,
) -> Result<String, String> {
    let config_path = get_mcp_config_path(&scope, project_path)?;
    let mut config = read_mcp_config_from_file(&config_path)?;

    if config.mcp_servers.remove(&name).is_none() {
        return Err(format!("Server '{}' not found in {} scope", name, scope));
    }

    write_mcp_config_to_file(&config_path, &config)?;
    Ok(config_path.to_string_lossy().to_string())
}

// ============================================================================
// Hooks Configuration Commands
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
struct HookConfig {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    matcher: Option<String>,
    command: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    timeout: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct HooksConfigFile {
    #[serde(default)]
    hooks: std::collections::HashMap<String, Vec<HookConfig>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct HookInfo {
    id: String,
    name: String,
    event_type: String,
    matcher: Option<String>,
    command: String,
    timeout: Option<u64>,
    scope: String,
    source_path: String,
    enabled: bool,
}

fn get_hooks_config_path(scope: &str, project_path: Option<String>) -> Result<PathBuf, String> {
    match scope {
        "user" => {
            let home_dir =
                dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
            Ok(home_dir.join(".claude").join("settings.json"))
        }
        "project" => {
            if let Some(proj_path) = project_path {
                Ok(PathBuf::from(proj_path).join(".claude").join("settings.json"))
            } else {
                Err("Project scope requires a project_path parameter".to_string())
            }
        }
        "local" => {
            if let Some(proj_path) = project_path {
                Ok(PathBuf::from(proj_path)
                    .join(".claude")
                    .join("settings.local.json"))
            } else {
                let home_dir =
                    dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
                Ok(home_dir.join(".claude").join("settings.local.json"))
            }
        }
        _ => Err(format!("Invalid hooks scope: {}", scope)),
    }
}

fn read_hooks_from_settings_file(path: &Path) -> Result<HooksConfigFile, String> {
    if !path.exists() {
        return Ok(HooksConfigFile::default());
    }

    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read hooks config file: {}", e))?;

    if content.trim().is_empty() {
        return Ok(HooksConfigFile::default());
    }

    // Parse the full settings file and extract hooks
    let full_settings: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse settings file: {}", e))?;

    let hooks_value = full_settings.get("hooks").cloned().unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
    let hooks: std::collections::HashMap<String, Vec<HookConfig>> = serde_json::from_value(hooks_value)
        .unwrap_or_default();

    Ok(HooksConfigFile { hooks })
}

fn write_hooks_to_settings_file(path: &Path, hooks_config: &HooksConfigFile) -> Result<(), String> {
    // Create parent directory if it doesn't exist
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // Read existing settings to preserve other fields
    let mut full_settings: serde_json::Value = if path.exists() {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Failed to read existing settings: {}", e))?;
        if content.trim().is_empty() {
            serde_json::Value::Object(serde_json::Map::new())
        } else {
            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse existing settings: {}", e))?
        }
    } else {
        serde_json::Value::Object(serde_json::Map::new())
    };

    // Update hooks field
    let hooks_value = serde_json::to_value(&hooks_config.hooks)
        .map_err(|e| format!("Failed to serialize hooks: {}", e))?;

    if let serde_json::Value::Object(ref mut map) = full_settings {
        map.insert("hooks".to_string(), hooks_value);
    }

    let content = serde_json::to_string_pretty(&full_settings)
        .map_err(|e| format!("Failed to serialize settings: {}", e))?;

    fs::write(path, content)
        .map_err(|e| format!("Failed to write settings file: {}", e))?;

    Ok(())
}

#[tauri::command]
async fn list_hooks(project_path: Option<String>) -> Result<Vec<HookInfo>, String> {
    let mut hooks = Vec::new();
    let mut hook_index = 0;

    // Read user-level config (~/.claude/settings.json)
    let user_path = get_hooks_config_path("user", None)?;
    if let Ok(config) = read_hooks_from_settings_file(&user_path) {
        for (event_type, event_hooks) in config.hooks {
            for hook_config in event_hooks {
                let name = format!("{}-hook-{}", event_type.to_lowercase(), hook_index);
                hooks.push(HookInfo {
                    id: format!("user:{}:{}", name, hook_index),
                    name: name.clone(),
                    event_type: event_type.clone(),
                    matcher: hook_config.matcher,
                    command: hook_config.command,
                    timeout: hook_config.timeout,
                    scope: "user".to_string(),
                    source_path: user_path.to_string_lossy().to_string(),
                    enabled: true,
                });
                hook_index += 1;
            }
        }
    }

    // Read project-level config (.claude/settings.json) if project_path provided
    if let Some(ref proj_path) = project_path {
        let project_config_path = get_hooks_config_path("project", Some(proj_path.clone()))?;
        if let Ok(config) = read_hooks_from_settings_file(&project_config_path) {
            for (event_type, event_hooks) in config.hooks {
                for hook_config in event_hooks {
                    let name = format!("{}-hook-{}", event_type.to_lowercase(), hook_index);
                    hooks.push(HookInfo {
                        id: format!("project:{}:{}", name, hook_index),
                        name: name.clone(),
                        event_type: event_type.clone(),
                        matcher: hook_config.matcher,
                        command: hook_config.command,
                        timeout: hook_config.timeout,
                        scope: "project".to_string(),
                        source_path: project_config_path.to_string_lossy().to_string(),
                        enabled: true,
                    });
                    hook_index += 1;
                }
            }
        }

        // Also check local settings
        let local_config_path = get_hooks_config_path("local", Some(proj_path.clone()))?;
        if let Ok(config) = read_hooks_from_settings_file(&local_config_path) {
            for (event_type, event_hooks) in config.hooks {
                for hook_config in event_hooks {
                    let name = format!("{}-hook-{}", event_type.to_lowercase(), hook_index);
                    hooks.push(HookInfo {
                        id: format!("local:{}:{}", name, hook_index),
                        name: name.clone(),
                        event_type: event_type.clone(),
                        matcher: hook_config.matcher,
                        command: hook_config.command,
                        timeout: hook_config.timeout,
                        scope: "local".to_string(),
                        source_path: local_config_path.to_string_lossy().to_string(),
                        enabled: true,
                    });
                    hook_index += 1;
                }
            }
        }
    }

    Ok(hooks)
}

#[tauri::command]
async fn read_hooks_config(
    scope: String,
    project_path: Option<String>,
) -> Result<HooksConfigFile, String> {
    let config_path = get_hooks_config_path(&scope, project_path)?;
    read_hooks_from_settings_file(&config_path)
}

#[tauri::command]
async fn write_hooks_config(
    scope: String,
    config: HooksConfigFile,
    project_path: Option<String>,
) -> Result<String, String> {
    let config_path = get_hooks_config_path(&scope, project_path)?;
    write_hooks_to_settings_file(&config_path, &config)?;
    Ok(config_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn add_hook(
    scope: String,
    event_type: String,
    hook_config: HookConfig,
    project_path: Option<String>,
) -> Result<String, String> {
    // Validate hook
    if hook_config.command.trim().is_empty() {
        return Err("Hook command cannot be empty".to_string());
    }

    let config_path = get_hooks_config_path(&scope, project_path)?;
    let mut config = read_hooks_from_settings_file(&config_path)?;

    // Add the hook to the appropriate event type array
    config.hooks
        .entry(event_type)
        .or_insert_with(Vec::new)
        .push(hook_config);

    write_hooks_to_settings_file(&config_path, &config)?;
    Ok(config_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn remove_hook(
    scope: String,
    event_type: String,
    hook_index: usize,
    project_path: Option<String>,
) -> Result<String, String> {
    let config_path = get_hooks_config_path(&scope, project_path)?;
    let mut config = read_hooks_from_settings_file(&config_path)?;

    if let Some(hooks) = config.hooks.get_mut(&event_type) {
        if hook_index < hooks.len() {
            hooks.remove(hook_index);
            // Remove the event type key if no hooks remain
            if hooks.is_empty() {
                config.hooks.remove(&event_type);
            }
        } else {
            return Err(format!("Hook index {} out of range", hook_index));
        }
    } else {
        return Err(format!("No hooks found for event type '{}'", event_type));
    }

    write_hooks_to_settings_file(&config_path, &config)?;
    Ok(config_path.to_string_lossy().to_string())
}

// ============================================================================
// Claude Code Session Detection Commands
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeSessionInfo {
    pid: u32,
    working_directory: String,
    start_time: u64,
    status: String,
    cpu_usage: Option<f32>,
    memory_usage: Option<u64>,
    command_line: Option<String>,
}

#[tauri::command]
async fn detect_claude_sessions() -> Result<Vec<ClaudeSessionInfo>, String> {
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};

    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything())
    );
    sys.refresh_processes();

    let mut sessions = Vec::new();

    for (pid, process) in sys.processes() {
        let name = process.name().to_lowercase();
        let cmd_str = process.cmd().iter()
            .map(|s| s.as_str())
            .collect::<Vec<_>>()
            .join(" ")
            .to_lowercase();

        // Look for claude code processes
        // Claude Code runs as node with specific command patterns
        let is_claude_code = name.contains("claude") ||
            cmd_str.contains("claude-code") ||
            cmd_str.contains("@anthropic/claude") ||
            (name.contains("node") && cmd_str.contains("claude"));

        // Exclude headless/print mode processes (automated invocations, not interactive sessions)
        // These are invoked by Vinsly for agent generation and should not count as user sessions
        let is_headless = cmd_str.contains(" -p ") || cmd_str.contains(" --print ");

        if is_claude_code && !is_headless {
            let cwd = process.cwd()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|| "unknown".to_string());

            let start_time = process.start_time();
            let cpu = process.cpu_usage();
            let memory = process.memory();

            // Determine status based on CPU usage
            let status = if cpu > 5.0 {
                "active"
            } else {
                "idle"
            };

            sessions.push(ClaudeSessionInfo {
                pid: pid.as_u32(),
                working_directory: cwd,
                start_time,
                status: status.to_string(),
                cpu_usage: Some(cpu),
                memory_usage: Some(memory),
                command_line: Some(cmd_str),
            });
        }
    }

    Ok(sessions)
}

#[tauri::command]
async fn kill_claude_session(app: tauri::AppHandle, pid: u32) -> Result<(), String> {
    use sysinfo::{ProcessRefreshKind, RefreshKind, System};
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

    // Security: Verify the PID is actually a Claude-related process before killing
    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything())
    );
    sys.refresh_processes();

    let target_pid = sysinfo::Pid::from_u32(pid);
    let process = sys.process(target_pid)
        .ok_or_else(|| format!("Process {} not found", pid))?;

    let name = process.name().to_lowercase();
    let cmd_str = process.cmd().iter()
        .map(|s| s.as_str())
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase();

    // Only allow killing Claude-related processes
    let is_claude_process = name.contains("claude") ||
        cmd_str.contains("claude-code") ||
        cmd_str.contains("@anthropic/claude") ||
        (name.contains("node") && cmd_str.contains("claude"));

    if !is_claude_process {
        return Err(format!("Process {} is not a Claude session", pid));
    }

    // Security: Show native confirmation dialog (cannot be spoofed by XSS)
    let confirmed = app.dialog()
        .message("Are you sure you want to terminate this Claude session?")
        .title("Confirm Session Termination")
        .kind(MessageDialogKind::Warning)
        .buttons(tauri_plugin_dialog::MessageDialogButtons::OkCancel)
        .blocking_show();

    if !confirmed {
        return Err("User cancelled the operation".to_string());
    }

    // Use the system kill command for reliability
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    {
        use std::process::Command;
        // First try SIGTERM for graceful shutdown
        let result = Command::new("kill")
            .arg("-15") // SIGTERM
            .arg(pid.to_string())
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    // If SIGTERM fails, try SIGKILL
                    let kill_result = Command::new("kill")
                        .arg("-9") // SIGKILL
                        .arg(pid.to_string())
                        .output();

                    match kill_result {
                        Ok(ko) if ko.status.success() => Ok(()),
                        _ => Err(format!("Failed to terminate process {}", pid))
                    }
                }
            }
            Err(e) => Err(format!("Failed to execute kill command: {}", e))
        }
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        // Use taskkill to terminate the process on Windows
        let result = Command::new("taskkill")
            .args(&["/PID", &pid.to_string(), "/F"])
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to terminate process {}: {}", pid, stderr.trim()))
                }
            }
            Err(e) => Err(format!("Failed to execute taskkill command: {}", e))
        }
    }

    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    {
        Err("kill_claude_session is not supported on this platform".to_string())
    }
}

// ============================================================================
// Claude Code CLI Integration
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
struct ClaudeCodeInvocationResult {
    success: bool,
    output: String,
    error: Option<String>,
}

/// Check if the Claude Code CLI is installed and accessible
#[tauri::command]
async fn check_claude_cli_installed() -> Result<bool, String> {
    use std::process::Command;

    let result = tauri::async_runtime::spawn_blocking(|| {
        Command::new("claude")
            .arg("--version")
            .output()
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?;

    match result {
        Ok(output) => Ok(output.status.success()),
        Err(_) => Ok(false), // CLI not found or not executable
    }
}

/// Invoke Claude Code in headless mode with the given prompt
/// Uses --output-format stream-json and parses the JSONL output
#[tauri::command]
async fn invoke_claude_code(prompt: String) -> Result<ClaudeCodeInvocationResult, String> {
    use std::io::{BufRead, BufReader, Read as IoRead};
    use std::process::{Command, Stdio};

    // Security: Validate prompt length to prevent abuse
    if prompt.len() > 50000 {
        return Err("Prompt too long (max 50000 characters)".to_string());
    }

    let result = tauri::async_runtime::spawn_blocking(move || -> Result<ClaudeCodeInvocationResult, String> {
        let mut cmd = Command::new("claude");
        cmd.args(["-p", &prompt, "--output-format", "stream-json", "--verbose"])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn claude: {}", e))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture stdout".to_string())?;

        let reader = BufReader::new(stdout);
        let mut final_result = String::new();
        let mut last_error: Option<String> = None;

        for line in reader.lines() {
            match line {
                Ok(line_str) => {
                    if line_str.trim().is_empty() {
                        continue;
                    }

                    // Parse each JSONL line
                    if let Ok(msg) = serde_json::from_str::<serde_json::Value>(&line_str) {
                        let msg_type = msg.get("type").and_then(|v| v.as_str()).unwrap_or("");

                        match msg_type {
                            "result" => {
                                // The final result message contains the output
                                if let Some(result_text) = msg.get("result").and_then(|v| v.as_str())
                                {
                                    final_result = result_text.to_string();
                                }
                            }
                            "error" => {
                                if let Some(error_msg) = msg.get("error").and_then(|v| v.as_str()) {
                                    last_error = Some(error_msg.to_string());
                                }
                            }
                            // Other message types (init, assistant, user, etc.) are progress
                            // We could emit events for these if we want real-time progress
                            _ => {}
                        }
                    }
                }
                Err(e) => {
                    last_error = Some(format!("Read error: {}", e));
                    break;
                }
            }
        }

        // Capture stderr for error reporting
        let stderr_output = child
            .stderr
            .take()
            .map(|mut stderr| {
                let mut stderr_content = String::new();
                let _ = IoRead::read_to_string(&mut stderr, &mut stderr_content);
                stderr_content
            })
            .unwrap_or_default();

        let status = child
            .wait()
            .map_err(|e| format!("Failed to wait for process: {}", e))?;

        if !status.success() {
            // Build error message from available sources
            let error_message = if !stderr_output.trim().is_empty() {
                stderr_output.trim().to_string()
            } else if let Some(ref err) = last_error {
                err.clone()
            } else {
                format!("Claude Code exited with status {}. Make sure you are logged in (run 'claude login' in terminal).", status)
            };

            return Ok(ClaudeCodeInvocationResult {
                success: false,
                output: String::new(),
                error: Some(error_message),
            });
        }

        let has_output = !final_result.is_empty();
        let error_msg = if !has_output && last_error.is_none() {
            Some("No output received from Claude Code".to_string())
        } else {
            last_error
        };

        Ok(ClaudeCodeInvocationResult {
            success: has_output,
            output: final_result,
            error: error_msg,
        })
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))??;

    Ok(result)
}

#[tauri::command]
fn open_full_disk_access_settings() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        const PRIVACY_URL: &str =
            "x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles";
        const SECURITY_FALLBACK_URL: &str =
            "x-apple.systempreferences:com.apple.preference.security";

        let attempts = [
            (
                "/usr/bin/open",
                vec!["-b", "com.apple.systempreferences", PRIVACY_URL],
            ),
            ("open", vec![PRIVACY_URL]),
            ("open", vec![SECURITY_FALLBACK_URL]),
        ];

        let mut last_error: Option<String> = None;
        for (binary, args) in attempts {
            let status_result = Command::new(binary).args(&args).status();
            match status_result {
                Ok(status) if status.success() => return Ok(()),
                Ok(status) => {
                    last_error = Some(format!(
                        "{} {} exited with status {}",
                        binary,
                        args.join(" "),
                        status
                    ));
                }
                Err(err) => {
                    last_error = Some(format!(
                        "Failed to run {} {}: {}",
                        binary,
                        args.join(" "),
                        err
                    ));
                }
            }
        }

        Err(last_error.unwrap_or_else(|| "Unable to open System Settings".to_string()))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Full Disk Access settings are only available on macOS".to_string())
    }
}

// ============================================================================
// Safe File Export/Import Commands (replaces unscoped fs plugin)
// ============================================================================

/// Paths that should never be read from or written to
const BLOCKED_PATH_PATTERNS: &[&str] = &[
    "/.ssh/",
    "\\.ssh\\",
    "/.gnupg/",
    "\\.gnupg\\",
    "/.aws/",
    "\\.aws\\",
    "/etc/",
    "/System/",
    "/Library/Keychains/",
    "/private/etc/",
    "\\Windows\\System32\\",
    "\\Windows\\SysWOW64\\",
    "/root/",
    "/.config/",
    "\\.config\\",
    "/Library/Preferences/",
    "/.local/share/keyrings/",
];

/// Maximum file size for import operations (10 MB)
const MAX_IMPORT_FILE_SIZE: u64 = 10 * 1024 * 1024;

/// Validates a path is safe for export/import (not in sensitive directories)
/// Uses canonicalization to prevent symlink and traversal attacks
fn validate_user_file_path(path: &Path, must_exist: bool) -> Result<PathBuf, String> {
    // First, reject obvious symlinks at the input path level
    if path.is_symlink() {
        return Err("Symlinks are not allowed".to_string());
    }

    // Canonicalize the path to resolve symlinks and .. in parent directories
    let canonical = if path.exists() {
        fs::canonicalize(path).map_err(|e| format!("Failed to resolve path: {}", e))?
    } else if must_exist {
        return Err("File does not exist".to_string());
    } else {
        // For non-existent paths (export), canonicalize the parent directory
        let parent = path.parent().ok_or("Invalid path: no parent directory")?;

        // If parent doesn't exist, we'll create it later - but check if grandparent exists
        let existing_ancestor = std::iter::successors(Some(parent), |p| p.parent())
            .find(|p| p.exists())
            .ok_or("Cannot resolve path: no existing ancestor directory")?;

        // Check if the existing ancestor is a symlink
        if existing_ancestor.is_symlink() {
            return Err("Path contains symlinks, which are not allowed".to_string());
        }

        let canonical_ancestor = fs::canonicalize(existing_ancestor)
            .map_err(|e| format!("Failed to resolve ancestor path: {}", e))?;

        // Rebuild the path from the canonical ancestor
        let relative_from_ancestor = path.strip_prefix(existing_ancestor)
            .unwrap_or(path);
        canonical_ancestor.join(relative_from_ancestor)
    };

    // After canonicalization, check if the resolved path is a symlink
    if canonical.is_symlink() {
        return Err("Resolved path is a symlink, which is not allowed".to_string());
    }

    // Normalize path separators for cross-platform matching
    let canonical_str = canonical.to_string_lossy().replace('\\', "/");

    // Check against blocked patterns on the CANONICAL path
    for pattern in BLOCKED_PATH_PATTERNS {
        // Normalize the pattern for comparison
        let normalized_pattern = pattern.replace('\\', "/");
        if canonical_str.contains(&normalized_pattern) {
            return Err(format!("Access to sensitive path is not allowed"));
        }
    }

    // Final check: canonical path should not contain .. (should never happen after canonicalize)
    if canonical_str.contains("..") {
        return Err("Path traversal detected".to_string());
    }

    Ok(canonical)
}

/// Write text content to a user-selected file path (for export)
#[tauri::command]
async fn export_text_file(path: String, content: String) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Validate the path is safe (must_exist=false for export - file doesn't exist yet)
    let canonical_path = validate_user_file_path(&file_path, false)?;

    // Create parent directories if needed
    if let Some(parent) = canonical_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    // Write to the canonical path
    fs::write(&canonical_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Write binary content to a user-selected file path (for export)
#[tauri::command]
async fn export_binary_file(path: String, content: Vec<u8>) -> Result<(), String> {
    let file_path = PathBuf::from(&path);

    // Validate the path is safe (must_exist=false for export - file doesn't exist yet)
    let canonical_path = validate_user_file_path(&file_path, false)?;

    // Create parent directories if needed
    if let Some(parent) = canonical_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }
    }

    // Write to the canonical path
    fs::write(&canonical_path, content)
        .map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(())
}

/// Read text content from a user-selected file path (for import)
#[tauri::command]
async fn import_text_file(path: String) -> Result<String, String> {
    let file_path = PathBuf::from(&path);

    // Validate the path is safe (must_exist=true for import - file must exist)
    let canonical_path = validate_user_file_path(&file_path, true)?;

    // Check file size
    let metadata = fs::metadata(&canonical_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    if metadata.len() > MAX_IMPORT_FILE_SIZE {
        return Err(format!(
            "File too large ({} bytes). Maximum allowed is {} bytes",
            metadata.len(),
            MAX_IMPORT_FILE_SIZE
        ));
    }

    // Read from the canonical path
    fs::read_to_string(&canonical_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Read binary content from a user-selected file path (for import)
#[tauri::command]
async fn import_binary_file(path: String) -> Result<Vec<u8>, String> {
    let file_path = PathBuf::from(&path);

    // Validate the path is safe (must_exist=true for import - file must exist)
    let canonical_path = validate_user_file_path(&file_path, true)?;

    // Check file size
    let metadata = fs::metadata(&canonical_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    if metadata.len() > MAX_ARCHIVE_SIZE {
        return Err(format!(
            "File too large ({} bytes). Maximum allowed is {} bytes",
            metadata.len(),
            MAX_ARCHIVE_SIZE
        ));
    }

    // Read from the canonical path
    fs::read(&canonical_path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

/// Set the window's title bar appearance and background color to match the app's theme
/// On macOS: Sets NSAppearance and NSWindow background color
//// Get the path to the theme cache file
/// This file stores a simple "dark" or "light" string that can be read synchronously on startup
fn get_theme_cache_path() -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join("com.vinsly.desktop").join("theme-cache.txt"))
}

/// Read the cached theme from disk (returns true for dark, false for light)
fn read_theme_cache() -> Option<bool> {
    let path = get_theme_cache_path()?;
    let content = fs::read_to_string(&path).ok()?;
    match content.trim() {
        "dark" => Some(true),
        "light" => Some(false),
        _ => None,
    }
}

/// Write the theme cache to disk (internal function)
fn write_theme_cache_internal(dark: bool) -> Result<(), String> {
    let path = get_theme_cache_path().ok_or("Could not determine data directory")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&path, if dark { "dark" } else { "light" }).map_err(|e| e.to_string())?;
    Ok(())
}

// On Windows/Linux: Sets the webview background color
#[tauri::command]
fn set_title_bar_theme(window: tauri::WebviewWindow, dark: bool) {
    // Also write to cache so the next startup uses this theme
    let _ = write_theme_cache_internal(dark);

    // Vinsly theme colors:
    // Dark mode:  #1f2229 = RGB(31, 34, 41)
    // Light mode: #F7F7F5 = RGB(247, 247, 245)

    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSColor, NSWindow};
        use cocoa::base::{id, nil};
        use cocoa::foundation::NSString;
        use objc::{class, msg_send, sel, sel_impl};

        let ns_window = window.ns_window();
        if let Ok(ns_win) = ns_window {
            unsafe {
                let ns_win = ns_win as id;

                // Set the NSAppearance (affects traffic light buttons and system UI)
                let appearance_name = if dark {
                    cocoa::foundation::NSString::alloc(nil).init_str("NSAppearanceNameDarkAqua")
                } else {
                    cocoa::foundation::NSString::alloc(nil).init_str("NSAppearanceNameAqua")
                };
                let appearance: id =
                    msg_send![class!(NSAppearance), appearanceNamed: appearance_name];
                let _: () = msg_send![ns_win, setAppearance: appearance];

                // Set the window background color to match Vinsly's theme
                let bg_color = if dark {
                    // Dark mode: #1f2229
                    NSColor::colorWithRed_green_blue_alpha_(
                        nil,
                        31.0 / 255.0,
                        34.0 / 255.0,
                        41.0 / 255.0,
                        1.0,
                    )
                } else {
                    // Light mode: #F7F7F5
                    NSColor::colorWithRed_green_blue_alpha_(
                        nil,
                        247.0 / 255.0,
                        247.0 / 255.0,
                        245.0 / 255.0,
                        1.0,
                    )
                };
                ns_win.setBackgroundColor_(bg_color);
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        // On Windows and Linux, set the webview background color
        use tauri::window::Color;
        let color = if dark {
            // Dark mode: #1f2229
            Color(31, 34, 41, 255)
        } else {
            // Light mode: #F7F7F5
            Color(247, 247, 245, 255)
        };
        let _ = window.set_background_color(Some(color));
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        // NOTE: fs plugin removed for security - use vetted export_*/import_* commands instead
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            // Read the cached theme and set the title bar appearance immediately
            // This prevents a flash when the app starts with a non-default theme
            let dark = read_theme_cache().unwrap_or(true); // Default to dark if no cache

            #[cfg(target_os = "macos")]
            {
                use cocoa::appkit::{NSColor, NSWindow};
                use cocoa::base::{id, nil};
                use cocoa::foundation::NSString;
                use objc::{class, msg_send, sel, sel_impl};

                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(ns_win) = window.ns_window() {
                        unsafe {
                            let ns_win = ns_win as id;

                            // Set NSAppearance
                            let appearance_name = if dark {
                                cocoa::foundation::NSString::alloc(nil)
                                    .init_str("NSAppearanceNameDarkAqua")
                            } else {
                                cocoa::foundation::NSString::alloc(nil)
                                    .init_str("NSAppearanceNameAqua")
                            };
                            let appearance: id = msg_send![
                                class!(NSAppearance),
                                appearanceNamed: appearance_name
                            ];
                            let _: () = msg_send![ns_win, setAppearance: appearance];

                            // Set background color
                            let bg_color = if dark {
                                NSColor::colorWithRed_green_blue_alpha_(
                                    nil,
                                    31.0 / 255.0,
                                    34.0 / 255.0,
                                    41.0 / 255.0,
                                    1.0,
                                )
                            } else {
                                NSColor::colorWithRed_green_blue_alpha_(
                                    nil,
                                    247.0 / 255.0,
                                    247.0 / 255.0,
                                    245.0 / 255.0,
                                    1.0,
                                )
                            };
                            ns_win.setBackgroundColor_(bg_color);
                        }
                    }
                }
            }

            #[cfg(not(target_os = "macos"))]
            {
                use tauri::window::Color;
                if let Some(window) = app.get_webview_window("main") {
                    let color = if dark {
                        Color(31, 34, 41, 255)
                    } else {
                        Color(247, 247, 245, 255)
                    };
                    let _ = window.set_background_color(Some(color));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_agents,
            read_agent,
            write_agent,
            delete_agent,
            list_agents_from_directory,
            list_skills,
            write_skill,
            delete_skill,
            migrate_skill,
            list_skills_from_directory,
            export_skill_directory,
            import_skill_archive,
            export_skills_archive,
            get_home_dir,
            discover_project_directories,
            check_full_disk_access,
            open_full_disk_access_settings,
            // CLAUDE.md (Memory) commands
            read_claude_memory,
            write_claude_memory,
            check_claude_memory_exists,
            export_memories_archive,
            import_memories_archive,
            // Slash commands
            list_slash_commands,
            read_slash_command,
            write_slash_command,
            delete_slash_command,
            list_slash_commands_from_directory,
            export_slash_commands_archive,
            import_slash_commands_archive,
            // MCP Server commands
            list_mcp_servers,
            read_mcp_config,
            write_mcp_config,
            add_mcp_server,
            remove_mcp_server,
            // Hooks commands
            list_hooks,
            read_hooks_config,
            write_hooks_config,
            add_hook,
            remove_hook,
            // Session detection and actions
            detect_claude_sessions,
            kill_claude_session,
            // Claude Code CLI integration
            check_claude_cli_installed,
            invoke_claude_code,
            // Safe file export/import (replaces fs plugin)
            export_text_file,
            export_binary_file,
            import_text_file,
            import_binary_file,
            // Window appearance
            set_title_bar_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
