pub mod scanner;

use scanner::{scan_project_directories, DEFAULT_DISCOVERY_DEPTH};
use serde::{Deserialize, Serialize};
use std::ffi::OsStr;
use std::fs;
use std::io::{ErrorKind, Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
#[cfg(target_os = "macos")]
use std::{env, process::Command};
use tokio::sync::Mutex;
use walkdir::WalkDir;
use zip::write::FileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

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

    let mut saw_claude = false;
    for component in canonical.components() {
        match component {
            Component::Normal(part) => {
                if saw_claude && part == subdir {
                    return Ok(());
                }
                saw_claude = part == ".claude";
            }
            _ => saw_claude = false,
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
    let mut agents_path = PathBuf::from(directory);
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

#[tauri::command]
async fn list_skills_from_directory(directory: String) -> Result<Vec<SkillFile>, String> {
    let mut skills_path = PathBuf::from(directory);
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
    let file =
        fs::File::open(archive_path).map_err(|e| format!("Failed to open archive: {}", e))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read archive: {}", e))?;

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
            target_dir.join(relative_path)
        };

        if entry.is_dir() {
            fs::create_dir_all(&output_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
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

    let destination_path = PathBuf::from(destination);
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
            Err(err) => {
                eprintln!(
                    "[FDA] scan-helper error: {}. Falling back to inline scanner.",
                    err
                );
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
        use std::fs;
        log_tcc_full_disk_status();

        let home_dir =
            dirs::home_dir().ok_or_else(|| "Failed to get home directory".to_string())?;
        let targets = [
            home_dir.join("Documents"),
            home_dir.join("Desktop"),
            home_dir.join("Library").join("Application Support"),
        ];

        tauri::async_runtime::block_on(async {
            let mut cache = home_discovery_cache().lock().await;
            *cache = None;
        });

        if let Some(allowed) = query_tcc_full_disk_entry()? {
            return Ok(allowed);
        }

        for target in targets {
            if !target.exists() {
                continue;
            }
            match fs::read_dir(&target) {
                Ok(_) => return Ok(true),
                Err(err) => match err.kind() {
                    ErrorKind::PermissionDenied => continue,
                    ErrorKind::NotFound => continue,
                    _ => {
                        return Err(format!("Failed to inspect {}: {}", target.display(), err));
                    }
                },
            }
        }

        Ok(false)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(true)
    }
}

#[cfg(target_os = "macos")]
fn log_tcc_full_disk_status() {
    match query_tcc_full_disk_entry() {
        Ok(Some(true)) => println!(
            "[FDA] TCC entry for {} allows Full Disk Access.",
            MACOS_BUNDLE_IDENTIFIER
        ),
        Ok(Some(false)) => println!(
            "[FDA] TCC entry for {} exists but is denied.",
            MACOS_BUNDLE_IDENTIFIER
        ),
        Ok(None) => println!(
            "[FDA] No TCC entry for {} found in TCC.db.",
            MACOS_BUNDLE_IDENTIFIER
        ),
        Err(err) => eprintln!("[FDA] Unable to inspect TCC.db: {}", err),
    }
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            list_agents,
            read_agent,
            write_agent,
            delete_agent,
            list_agents_from_directory,
            list_skills,
            write_skill,
            delete_skill,
            list_skills_from_directory,
            export_skill_directory,
            import_skill_archive,
            export_skills_archive,
            get_home_dir,
            discover_project_directories,
            check_full_disk_access,
            open_full_disk_access_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
