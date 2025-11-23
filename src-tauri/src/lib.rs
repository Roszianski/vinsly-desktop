pub mod scanner;

use scanner::{scan_project_directories, DEFAULT_DISCOVERY_DEPTH};
use serde::{Deserialize, Serialize};
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
#[cfg(target_os = "macos")]
use std::{env, process::Command};
use tokio::sync::Mutex;

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

fn validate_agent_name(name: &str) -> Result<(), String> {
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

fn ensure_path_in_agents_dir(path: &Path) -> Result<(), String> {
    let canonical =
        std::fs::canonicalize(path).map_err(|e| format!("Failed to resolve path: {}", e))?;

    let mut saw_claude = false;
    for component in canonical.components() {
        match component {
            Component::Normal(part) => {
                if saw_claude && part == "agents" {
                    return Ok(());
                }
                saw_claude = part == ".claude";
            }
            _ => saw_claude = false,
        }
    }

    Err("Refusing to modify files outside .claude/agents".to_string())
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
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read agent file: {}", e))
}

// Write an agent file
#[tauri::command]
async fn write_agent(
    scope: String,
    name: String,
    content: String,
    project_path: Option<String>,
) -> Result<String, String> {
    validate_agent_name(&name)?;
    let agents_dir = get_agents_dir(&scope, project_path)?;

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&agents_dir)
        .map_err(|e| format!("Failed to create directory: {}", e))?;

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
            get_home_dir,
            discover_project_directories,
            check_full_disk_access,
            open_full_disk_access_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
