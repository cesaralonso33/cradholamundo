#!/usr/bin/env python3
"""Upload the deployable project to a VPS over SSH/SFTP.

Safe by default: performs a dry run unless --apply is supplied and excludes
secrets, dependencies, build output, git metadata and real uploads.
"""

from __future__ import annotations

import argparse
import posixpath
import shutil
import subprocess
import tempfile
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Falta Paramiko. Instala con: python -m pip install -r scripts/requirements-deploy.txt", file=sys.stderr)
    raise SystemExit(2)


DEFAULT_EXCLUDES = {
    ".git", ".superpowers", ".opencode", ".agents", ".claude", ".gemini", ".codex",
    "node_modules", "dist", "frontend/node_modules", "frontend/dist", "uploads",
    ".env", ".env.*", "*.ppk", "*.pem", "*.key", "*.log",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sube el proyecto al VPS por SSH/SFTP.")
    parser.add_argument("--host", required=True, help="Host o IP del VPS")
    parser.add_argument("--user", required=True, help="Usuario SSH")
    parser.add_argument("--key", required=True, type=Path, help="Ruta local al archivo .ppk")
    parser.add_argument("--port", type=int, default=22, help="Puerto SSH (por defecto: 22)")
    parser.add_argument("--source", type=Path, default=Path(__file__).resolve().parents[1], help="Carpeta local")
    parser.add_argument("--target", default="/opt/inventario", help="Carpeta destino en el VPS")
    parser.add_argument("--apply", action="store_true", help="Ejecuta la subida; sin esto solo simula")
    return parser.parse_args()


def excluded(path: Path, source: Path) -> bool:
    relative = path.relative_to(source).as_posix()
    parts = relative.split("/")
    name = path.name
    return any(
        pattern == relative or pattern == name or (pattern.endswith("/*") and relative.startswith(pattern[:-1]))
        or (pattern.startswith("*.") and name.endswith(pattern[1:]))
        or (pattern.endswith(".*") and name.startswith(pattern[:-1]))
        for pattern in DEFAULT_EXCLUDES
    ) or any(part in DEFAULT_EXCLUDES for part in parts[:-1])


def files_to_upload(source: Path) -> list[Path]:
    return [p for p in source.rglob("*") if p.is_file() and not excluded(p, source)]


def load_key(path: Path):
    try:
        return paramiko.PKey.from_path(str(path))
    except Exception as original:
        if path.suffix.lower() != ".ppk":
            raise RuntimeError(f"No se pudo leer la clave privada: {path}") from original

        puttygen = shutil.which("puttygen")
        if not puttygen:
            for candidate in (
                Path(r"C:\Program Files\PuTTY\puttygen.exe"),
                Path(r"C:\Program Files (x86)\PuTTY\puttygen.exe"),
            ):
                if candidate.exists():
                    puttygen = str(candidate)
                    break
        if not puttygen:
            raise RuntimeError(
                "Paramiko no lee este .ppk directamente. Instala PuTTYgen o conviértelo una vez: "
                "PuTTYgen > Load private key > Conversions > Export OpenSSH key."
            ) from original

        with tempfile.TemporaryDirectory(prefix="vps-key-") as temp_dir:
            converted = Path(temp_dir) / "id_openssh"
            result = subprocess.run(
                [puttygen, str(path), "-O", "private-openssh-new", "-o", str(converted)],
                capture_output=True,
                text=True,
            )
            if result.returncode != 0:
                detail = (result.stderr or result.stdout).strip()
                raise RuntimeError(
                    "PuTTYgen no pudo convertir el .ppk. Si tiene contraseña, conviértelo manualmente "
                    f"con PuTTYgen. Detalle: {detail}"
                ) from original
            return paramiko.PKey.from_path(str(converted))


def remote_parent(sftp: paramiko.SFTPClient, path: str) -> None:
    current = "/"
    for part in path.strip("/").split("/")[:-1]:
        current = posixpath.join(current, part)
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def upload(args: argparse.Namespace) -> None:
    source = args.source.resolve()
    key = load_key(args.key.resolve())
    files = files_to_upload(source)
    print(f"Archivos seleccionados: {len(files)}")
    print(f"Destino: {args.user}@{args.host}:{args.port}{args.target}")
    print("Excluidos: secretos, node_modules, dist, uploads, .git y archivos de claves")

    if not args.apply:
        for file in files:
            print("DRY-RUN", file.relative_to(source).as_posix())
        print("Simulación finalizada. Añade --apply para subir realmente.")
        return

    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        client.connect(args.host, port=args.port, username=args.user, pkey=key, timeout=20)
        with client.open_sftp() as sftp:
            for file in files:
                relative = file.relative_to(source).as_posix()
                remote = posixpath.join(args.target.rstrip("/"), relative)
                remote_parent(sftp, remote)
                print("SUBIENDO", relative)
                sftp.put(str(file), remote)
    finally:
        client.close()
    print("Subida completada.")


if __name__ == "__main__":
    try:
        upload(parse_args())
    except (OSError, RuntimeError, paramiko.SSHException) as exc:
        print(f"Error de despliegue: {exc}", file=sys.stderr)
        raise SystemExit(1)
