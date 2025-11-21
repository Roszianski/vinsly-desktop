use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};
use serde::{Deserialize, Serialize};
use walkdir::WalkDir;

const DEFAULT_DISCOVERY_DEPTH: usize = 12;

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
    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("Failed to resolve path: {}", e))?;

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
            let home_dir = dirs::home_dir()
                .ok_or_else(|| "Failed to get home directory".to_string())?;
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
async fn list_agents(scope: String, project_path: Option<String>) -> Result<Vec<AgentFile>, String> {
    let agents_dir = get_agents_dir(&scope, project_path)?;

    if !agents_dir.exists() {
        return Ok(Vec::new());
    }

    let mut agents = Vec::new();

    let entries = std::fs::read_dir(&agents_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            let name = path.file_stem()
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
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read agent file: {}", e))
}

// Write an agent file
#[tauri::command]
async fn write_agent(scope: String, name: String, content: String, project_path: Option<String>) -> Result<String, String> {
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
        let home = dirs::home_dir()
            .ok_or_else(|| "Failed to get home directory".to_string())?;
        Ok(home.join(&path[2..]))
    } else if path.starts_with("~") && path.len() == 1 {
        dirs::home_dir()
            .ok_or_else(|| "Failed to get home directory".to_string())
    } else {
        Ok(PathBuf::from(path))
    }
}

// Delete an agent file
#[tauri::command]
async fn delete_agent(path: String) -> Result<(), String> {
    let expanded_path = expand_path(&path)?;
    ensure_path_in_agents_dir(&expanded_path)?;
    std::fs::remove_file(&expanded_path)
        .map_err(|e| format!("Failed to delete agent file: {}", e))
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

    let entries = std::fs::read_dir(&agents_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file: {}", e))?;

            let name = path.file_stem()
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

#[tauri::command]
async fn discover_project_directories(max_depth: Option<usize>) -> Result<Vec<String>, String> {
    use std::ffi::OsStr;
    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to get home directory".to_string())?;
    let depth = max_depth.unwrap_or(DEFAULT_DISCOVERY_DEPTH).max(1);
    let mut directories = Vec::new();
    let mobile_documents = home_dir.join("Library").join("Mobile Documents");
    let cloud_storage = home_dir.join("Library").join("CloudStorage");
    let container_storage = home_dir.join("Library").join("Containers");
    let skip_dir_names = [".Trash", "node_modules", ".git", ".cache", ".npm"];

    let walker = WalkDir::new(&home_dir)
        .max_depth(depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            let path = entry.path();
            if path.starts_with(&mobile_documents)
                || path.starts_with(&cloud_storage)
                || path.starts_with(&container_storage)
            {
                return false;
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
                if entry.file_type().is_dir() && entry.file_name() == OsStr::new(".claude") {
                    let agents_path = entry.path().join("agents");
                    if agents_path.exists() {
                        // Skip the global ~/.claude/agents directory
                        if entry.path() == home_dir.join(".claude") {
                            continue;
                        }
                        if let Some(project_root) = entry.path().parent() {
                            directories.push(project_root.to_string_lossy().to_string());
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            list_agents,
            read_agent,
            write_agent,
            delete_agent,
            list_agents_from_directory,
            get_home_dir,
            discover_project_directories,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
