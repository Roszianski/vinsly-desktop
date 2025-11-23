use std::error::Error;

use tauri_app_lib::scanner::{scan_project_directories, DEFAULT_DISCOVERY_DEPTH};

fn main() {
    if let Err(err) = run() {
        eprintln!("{err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn Error>> {
    let mut depth = DEFAULT_DISCOVERY_DEPTH;
    let mut include_protected = false;

    let mut args = std::env::args().skip(1).peekable();
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--depth" => {
                let value = args
                    .next()
                    .ok_or_else(|| "Missing value for --depth".to_string())?;
                depth = value
                    .parse::<usize>()
                    .map_err(|_| format!("Invalid depth value: {}", value))?
                    .max(1);
            }
            "--include-protected" => include_protected = true,
            "--help" | "-h" => {
                print_usage();
                return Ok(());
            }
            other => {
                return Err(format!("Unknown argument: {}", other).into());
            }
        }
    }

    let home_dir = dirs::home_dir()
        .ok_or_else(|| "Failed to resolve the current user's home directory".to_string())?;
    let directories = scan_project_directories(home_dir, depth, include_protected)?;
    println!("{}", serde_json::to_string(&directories)?);
    Ok(())
}

fn print_usage() {
    println!("Vinsly scan-helper");
    println!();
    println!("Usage: scan-helper [--depth <number>] [--include-protected]");
    println!("  --depth <number>          Maximum directory depth (default: 12)");
    println!("  --include-protected       Include macOS protected directories");
}
