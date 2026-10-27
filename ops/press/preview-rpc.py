"""Run the guarded synthetic Press fixtures in the isolated Phoenix release."""

import argparse
import base64
import json
import os
from pathlib import Path
import shlex
import subprocess


def main():
    actions = {
        "seed": "GroupherServer.PressPreview.Fixtures.seed()",
        "snapshot": "{:ok, GroupherServer.PressPreview.Fixtures.snapshot()}",
        "probe": "GroupherServer.PressPreview.Fixtures.probe()",
    }
    for thread in ("post", "blog", "changelog", "doc"):
        for action in ("hold", "restore"):
            actions[f"{action}:{thread}"] = (
                f"GroupherServer.PressPreview.Fixtures.{action}(:{thread})"
            )

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=actions)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()

    machines = subprocess.run(
        ["fly", "machines", "list", "--app", "groupher-press-preview-api", "--json"],
        capture_output=True, text=True, timeout=45, check=True,
    )
    machine_count = len(json.loads(machines.stdout))
    if machine_count != 1:
        raise RuntimeError("Press fixtures require exactly one preview Machine for queue isolation")

    health = subprocess.run(
        [
            "curl", "-sS", "--max-time", "40", "-o", os.devnull,
            "-w", "%{http_code}",
            "https://groupher-press-preview-api.fly.dev/health",
        ],
        capture_output=True,
        text=True,
        timeout=45,
        check=True,
    )
    if health.stdout != "200":
        raise RuntimeError(f"Preview Phoenix health returned HTTP {health.stdout}")

    source_file = Path(__file__).with_name("preview-fixtures.exs")
    source = base64.b64encode(source_file.read_bytes()).decode()
    expression = (
        f'try do Code.eval_string(Base.decode64!("{source}")); '
        'previous = Application.fetch_env!(:groupher_server, :search_artiments); '
        f"result = try do {actions[args.action]} after "
        'if previous != Application.fetch_env!(:groupher_server, :search_artiments), '
        'do: raise("Fixture leaked Search configuration") end; '
        'case result do {:ok, value} -> IO.puts("PRESS_ACCEPTANCE=" <> '
        'Jason.encode!(%{ok: true, result: value})); other -> '
        'IO.puts("PRESS_ACCEPTANCE=" <> Jason.encode!(%{ok: false, '
        'error: inspect(other)})) end rescue e -> '
        'IO.puts("PRESS_ACCEPTANCE=" <> Jason.encode!(%{ok: false, '
        'error: Exception.message(e)})) end'
    )
    command = shlex.join(["/app/bin/groupher_server", "rpc", expression])
    process = subprocess.run(
        [
            "fly", "ssh", "console", "--app", "groupher-press-preview-api",
            "--command", command,
        ],
        capture_output=True,
        text=True,
        timeout=55,
    )
    marker = "PRESS_ACCEPTANCE="
    line = next(
        (line[len(marker):] for line in process.stdout.splitlines() if line.startswith(marker)),
        None,
    )
    if line is None:
        raise RuntimeError(f"Preview RPC failed (exit {process.returncode})")
    payload = json.loads(line)
    print(json.dumps({"action": args.action, "machine_count": machine_count, **payload}))
    if not payload.get("ok"):
        return 1
    if args.output:
        descriptor = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(descriptor, "w") as output:
            json.dump(payload["result"], output, indent=2)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
