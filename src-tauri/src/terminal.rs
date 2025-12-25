use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use tauri::{AppHandle, Emitter};

/// Event payload for terminal output
#[derive(Clone, Serialize)]
pub struct TerminalOutputEvent {
    pub terminal_id: String,
    pub data: String, // Base64 encoded
}

/// Event payload for terminal exit
#[derive(Clone, Serialize)]
pub struct TerminalExitEvent {
    pub terminal_id: String,
    pub exit_code: Option<i32>,
}

/// Represents a single terminal instance
struct TerminalInstance {
    #[allow(dead_code)]
    id: String,
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn Write + Send>,
    #[allow(dead_code)]
    child: Box<dyn portable_pty::Child + Send + Sync>,
}

/// Manages all active terminal instances
struct TerminalManager {
    terminals: HashMap<String, TerminalInstance>,
}

impl TerminalManager {
    fn new() -> Self {
        Self {
            terminals: HashMap::new(),
        }
    }

    fn add(&mut self, id: String, instance: TerminalInstance) {
        self.terminals.insert(id, instance);
    }

    fn remove(&mut self, id: &str) -> Option<TerminalInstance> {
        self.terminals.remove(id)
    }

    fn get_mut(&mut self, id: &str) -> Option<&mut TerminalInstance> {
        self.terminals.get_mut(id)
    }

    fn clear(&mut self) -> Vec<String> {
        let ids: Vec<String> = self.terminals.keys().cloned().collect();
        self.terminals.clear();
        ids
    }
}

/// Global terminal manager instance
static TERMINAL_MANAGER: OnceLock<Arc<Mutex<TerminalManager>>> = OnceLock::new();

fn get_manager() -> Arc<Mutex<TerminalManager>> {
    TERMINAL_MANAGER
        .get_or_init(|| Arc::new(Mutex::new(TerminalManager::new())))
        .clone()
}

/// Get the default shell for the current platform
pub fn get_default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}

/// Create a new terminal session
pub fn create_terminal(
    app: AppHandle,
    working_dir: Option<String>,
    shell: Option<String>,
    cols: u16,
    rows: u16,
) -> Result<String, String> {
    let terminal_id = uuid::Uuid::new_v4().to_string();

    // Determine working directory
    let cwd = match working_dir {
        Some(dir) => PathBuf::from(dir),
        None => dirs::home_dir().unwrap_or_else(|| PathBuf::from("/")),
    };

    // Verify directory exists
    if !cwd.exists() {
        return Err(format!("Working directory does not exist: {:?}", cwd));
    }

    // Determine shell to use
    let shell_path = shell.unwrap_or_else(get_default_shell);

    // Create PTY system
    let pty_system = native_pty_system();

    // Create PTY pair with specified size
    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Build command - use interactive login shell on Unix to get full user environment
    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = CommandBuilder::new(&shell_path);
        // Add -i (interactive) and -l (login) flags:
        // -i: Interactive mode - enables prompt, cursor, job control
        // -l: Login shell - sources user's shell config (~/.zshrc, ~/.bash_profile, etc.)
        // This is critical for GUI apps on macOS which don't inherit terminal environment
        c.arg("-il");
        c
    };

    #[cfg(target_os = "windows")]
    let mut cmd = CommandBuilder::new(&shell_path);

    cmd.cwd(&cwd);

    // Set environment variables
    #[cfg(not(target_os = "windows"))]
    {
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Ensure HOME is set (critical for shell config discovery)
        if let Some(home) = dirs::home_dir() {
            cmd.env("HOME", home.to_string_lossy().to_string());
        }

        // Set LANG for proper Unicode support
        if std::env::var("LANG").is_err() {
            cmd.env("LANG", "en_US.UTF-8");
        }
    }

    // Spawn the shell process
    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    // Get reader from master for output
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to clone reader: {}", e))?;

    // Get writer for input
    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get writer: {}", e))?;

    // Store the terminal instance
    let instance = TerminalInstance {
        id: terminal_id.clone(),
        master: pair.master,
        writer,
        child,
    };

    {
        let manager = get_manager();
        let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;
        manager.add(terminal_id.clone(), instance);
    }

    // Spawn thread to read output and emit events
    let id_for_reader = terminal_id.clone();
    let app_for_reader = app.clone();

    thread::spawn(move || {
        let mut reader = reader;
        let mut buffer = [0u8; 4096];

        loop {
            match reader.read(&mut buffer) {
                Ok(0) => {
                    // EOF - terminal closed
                    break;
                }
                Ok(n) => {
                    // Encode as base64 for safe transmission
                    let encoded = BASE64.encode(&buffer[..n]);

                    // Emit output event
                    let _ = app_for_reader.emit(
                        "terminal:output",
                        TerminalOutputEvent {
                            terminal_id: id_for_reader.clone(),
                            data: encoded,
                        },
                    );
                }
                Err(e) => {
                    // Error reading - terminal likely closed
                    eprintln!("Terminal read error: {}", e);
                    break;
                }
            }
        }

        // Emit exit event
        let _ = app_for_reader.emit(
            "terminal:exit",
            TerminalExitEvent {
                terminal_id: id_for_reader,
                exit_code: None,
            },
        );
    });

    Ok(terminal_id)
}

/// Write data to a terminal's stdin
pub fn write_to_terminal(terminal_id: &str, data: &str) -> Result<(), String> {
    let manager = get_manager();
    let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;

    let instance = manager
        .get_mut(terminal_id)
        .ok_or_else(|| format!("Terminal not found: {}", terminal_id))?;

    // Decode base64 data from frontend
    let bytes = BASE64
        .decode(data)
        .map_err(|e| format!("Failed to decode input: {}", e))?;

    instance
        .writer
        .write_all(&bytes)
        .map_err(|e| format!("Failed to write to terminal: {}", e))?;

    instance
        .writer
        .flush()
        .map_err(|e| format!("Failed to flush terminal: {}", e))?;

    Ok(())
}

/// Resize a terminal
pub fn resize_terminal(terminal_id: &str, cols: u16, rows: u16) -> Result<(), String> {
    let manager = get_manager();
    let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;

    let instance = manager
        .get_mut(terminal_id)
        .ok_or_else(|| format!("Terminal not found: {}", terminal_id))?;

    instance
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to resize terminal: {}", e))?;

    Ok(())
}

/// Close a terminal and kill its process
pub fn close_terminal(terminal_id: &str) -> Result<(), String> {
    let manager = get_manager();
    let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;

    if let Some(mut instance) = manager.remove(terminal_id) {
        // Explicitly kill the child process
        if let Err(e) = instance.child.kill() {
            eprintln!("Warning: Failed to kill terminal process: {}", e);
        }
        // Wait for the process to fully terminate
        let _ = instance.child.wait();
        Ok(())
    } else {
        Err(format!("Terminal not found: {}", terminal_id))
    }
}

/// Close all terminals (for app cleanup)
pub fn close_all_terminals() -> Result<Vec<String>, String> {
    let manager = get_manager();
    let mut manager = manager.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut closed_ids = Vec::new();
    for (id, mut instance) in manager.terminals.drain() {
        // Explicitly kill each child process
        if let Err(e) = instance.child.kill() {
            eprintln!("Warning: Failed to kill terminal process {}: {}", id, e);
        }
        let _ = instance.child.wait();
        closed_ids.push(id);
    }
    Ok(closed_ids)
}
