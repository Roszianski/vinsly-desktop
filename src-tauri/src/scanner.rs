use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use walkdir::WalkDir;

pub const DEFAULT_DISCOVERY_DEPTH: usize = 12;

#[cfg(target_os = "macos")]
fn macos_protected_dirs(home_dir: &Path) -> Vec<PathBuf> {
    let mut dirs = vec![
        home_dir.join("Applications"),
        home_dir.join("Desktop"),
        home_dir.join("Documents"),
        home_dir.join("Downloads"),
        home_dir.join("Movies"),
        home_dir.join("Music"),
        home_dir.join("Pictures"),
        home_dir.join("Public"),
        home_dir.join("Library"),
    ];

    dirs.push(home_dir.join("Library").join("Mobile Documents"));
    dirs.push(home_dir.join("Library").join("CloudStorage"));
    dirs.push(home_dir.join("Library").join("Containers"));
    dirs
}

#[cfg(not(target_os = "macos"))]
fn macos_protected_dirs(_home_dir: &Path) -> Vec<PathBuf> {
    Vec::new()
}

pub fn scan_project_directories(
    home_dir: PathBuf,
    depth: usize,
    include_protected: bool,
) -> Result<Vec<String>, String> {
    use std::ffi::OsStr;

    let mut directories = Vec::new();
    let protected_dirs = macos_protected_dirs(&home_dir);
    let global_agents_dir = home_dir.join(".claude");
    let skip_dir_names = [".Trash", "node_modules", ".git", ".cache", ".npm"];

    let walker = WalkDir::new(&home_dir)
        .max_depth(depth)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            let path = entry.path();
            if !include_protected {
                if protected_dirs
                    .iter()
                    .any(|protected| path.starts_with(protected))
                {
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
                if entry.file_type().is_dir() && entry.file_name() == OsStr::new(".claude") {
                    let agents_path = entry.path().join("agents");
                    if agents_path.exists() {
                        if entry.path() == global_agents_dir {
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
