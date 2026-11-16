// @effect-diagnostics-next-line nodeBuiltinImport:off -- The installer helper must outlive the desktop process.
import * as NodeChildProcess from "node:child_process";

export function launchWindowsForkUpdateHelper(script: string): Promise<number> {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  // Detached PowerShell can exit before executing; Start-Process gives the helper its own lifetime.
  const launcher = `$ErrorActionPreference = 'Stop'; (Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}' -PassThru).Id`;
  return new Promise((resolve, reject) => {
    NodeChildProcess.execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", launcher],
      { windowsHide: true },
      (error, stdout) => {
        if (error) reject(error);
        else resolve(Number(stdout.trim()));
      },
    );
  });
}
