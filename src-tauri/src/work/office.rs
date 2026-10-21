use super::{process, types::RuntimeManifest};
use std::{
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};

pub const ID: &str = "office";

pub fn python_path(root: &Path) -> PathBuf {
    root.join("runtimes").join(ID).join(if cfg!(windows) {
        "Scripts/python.exe"
    } else {
        "bin/python"
    })
}

pub fn manifest(root: &Path) -> RuntimeManifest {
    let python = python_path(root);
    let installed = python.is_file() && root.join("runtimes").join(ID).join(".ready").is_file();
    RuntimeManifest {
        id: ID.into(),
        name: "EM Office Agent".into(),
        description: "Excel / CSV / Word / PDF / images · structured office tools".into(),
        protocol: "acp-v1".into(),
        installed,
        version: Some("1.0.0".into()),
        executable_path: installed.then(|| python.to_string_lossy().into_owned()),
        source: "builtin".into(),
        install_state: "idle".into(),
        supports: vec![
            "tools".into(),
            "permissions".into(),
            "spreadsheets".into(),
            "documents".into(),
            "images".into(),
        ],
    }
}

fn find_python() -> Result<PathBuf, String> {
    let mut candidates = Vec::<PathBuf>::new();
    if let Some(path) = std::env::var_os("EM_WORK_PYTHON") {
        candidates.push(path.into());
    }
    candidates.extend([PathBuf::from("python"), PathBuf::from("python3"), PathBuf::from("py")]);
    if let Some(local) = std::env::var_os("LOCALAPPDATA") {
        if let Ok(entries) = std::fs::read_dir(PathBuf::from(local).join("Programs/Python")) {
            for entry in entries.flatten() {
                candidates.push(entry.path().join("python.exe"));
            }
        }
    }
    for candidate in candidates {
        let mut command = Command::new(candidate);
        command.args([
            "-I",
            "-c",
            "import sys; assert sys.version_info >= (3, 10); print(sys.executable)",
        ]);
        process::hide_console(&mut command);
        if let Ok(output) = command.output() {
            if output.status.success() {
                let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if Path::new(&path).is_file() {
                    return Ok(PathBuf::from(path));
                }
            }
        }
    }
    Err("WORK_OFFICE_PYTHON_REQUIRED".into())
}

async fn run(command: &mut tokio::process::Command) -> Result<(), String> {
    process::hide_console_tokio(command);
    command.kill_on_drop(true);
    let output = tokio::time::timeout(Duration::from_secs(300), command.output())
        .await
        .map_err(|_| "WORK_OFFICE_INSTALL_TIMEOUT")?
        .map_err(|error| format!("WORK_OFFICE_INSTALL_FAILED: {error}"))?;
    if !output.status.success() {
        // pip errors can contain authenticated index URLs; do not expose stderr.
        return Err("WORK_OFFICE_INSTALL_FAILED".into());
    }
    Ok(())
}

pub async fn install(root: &Path) -> Result<String, String> {
    let python =
        tokio::task::spawn_blocking(find_python).await.map_err(|error| error.to_string())??;
    let environment = root.join("runtimes").join(ID);
    let mut create = tokio::process::Command::new(python);
    create.args(["-I", "-m", "venv"]).arg(&environment);
    run(&mut create).await?;
    let executable = python_path(root);
    let mut pip = tokio::process::Command::new(&executable);
    pip.args([
        "-I",
        "-m",
        "pip",
        "--isolated",
        "install",
        "--disable-pip-version-check",
        "openpyxl==3.1.5",
        "python-docx==1.2.0",
        "Pillow==12.0.0",
        "pypdf==6.1.3",
    ]);
    run(&mut pip).await?;
    let mut verify = tokio::process::Command::new(&executable);
    verify.args(["-I", "-c", "import openpyxl, docx, PIL, pypdf"]);
    run(&mut verify).await?;
    materialize(root)?;
    std::fs::write(environment.join(".ready"), b"1").map_err(|error| error.to_string())?;
    Ok(executable.to_string_lossy().into_owned())
}

pub fn materialize(root: &Path) -> Result<PathBuf, String> {
    let directory = root.join("runtime-data").join(ID);
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let script = directory.join("office_agent.py");
    std::fs::write(&script, include_str!("office_agent.py")).map_err(|error| error.to_string())?;
    std::fs::write(directory.join("office_tools.py"), include_str!("office_tools.py"))
        .map_err(|error| error.to_string())?;
    Ok(script)
}
