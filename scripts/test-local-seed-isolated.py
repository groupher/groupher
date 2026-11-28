#!/usr/bin/env python3
"""Run seed concurrency and recovery tests against a disposable local PostgreSQL cluster.

The test source, dependencies, and build output are copied to a temporary directory.
The cluster and database are created there and removed after PostgreSQL stops.
"""

from contextlib import contextmanager
import os
from pathlib import Path
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
from time import perf_counter


@contextmanager
def timed(label):
    started = perf_counter()
    try:
        yield
    finally:
        print(f"[timing] {label}: {perf_counter() - started:.2f}s", flush=True)


def main():
    root = Path(__file__).resolve().parent.parent
    source = root / "backend" / "api"
    if not (source / "deps").is_dir():
        raise RuntimeError("Install the backend Mix dependencies before running this test.")

    temporary = Path(tempfile.mkdtemp(prefix="groupher-seed-isolated-"))
    data = temporary / "postgres"
    copied = temporary / "checkout" / "backend" / "api"
    started = False
    stopped = False
    environment = {
        key: value
        for key, value in os.environ.items()
        if not key.startswith("PG")
        and key not in {"MIX_BUILD_PATH", "MIX_DEPS_PATH", "DATABASE_URL"}
    }

    def interrupt(_signum, _frame):
        raise KeyboardInterrupt

    # Run the same cleanup when a job runner requests termination.
    signal.signal(signal.SIGTERM, interrupt)
    signal.signal(signal.SIGHUP, interrupt)
    try:
        print("Preparing an isolated backend copy and PostgreSQL cluster...", flush=True)
        with timed("Copy backend source"):
            shutil.copytree(
                source,
                copied,
                symlinks=True,
                ignore=shutil.ignore_patterns("_build", "deps", ".elixir_ls", "node_modules"),
            )
        with timed("Copy Mix dependencies"):
            shutil.copytree(source / "deps", copied / "deps", symlinks=True)
        build = source / "_build" / "test"
        if build.is_dir():
            with timed("Copy test build cache"):
                shutil.copytree(build, copied / "_build" / "test", symlinks=True)

        with timed("Initialize PostgreSQL and create the seed database"):
            with socket.socket() as listener:
                listener.bind(("127.0.0.1", 0))
                port = listener.getsockname()[1]

            subprocess.run(
                ["initdb", "-D", str(data), "-A", "trust", "-U", "postgres", "--no-instructions"],
                check=True,
                env=environment,
                stdout=subprocess.DEVNULL,
            )
            # Treat an interrupted startup as potentially live. If pg_ctl cannot
            # stop it, preserve the directory for diagnosis rather than deleting it.
            started = True
            subprocess.run(
                ["pg_ctl", "-D", str(data), "-l", str(temporary / "postgres.log"), "-o",
                 f"-h 127.0.0.1 -p {port}", "-w", "start"],
                check=True,
                env=environment,
                stdout=subprocess.DEVNULL,
            )
            subprocess.run(
                ["createdb", "-h", "127.0.0.1", "-p", str(port), "-U", "postgres",
                 "groupher_seed_concurrency"],
                check=True,
                env=environment,
            )
        with timed("Check primary database protections"):
            for purpose in ("dev", "test"):
                database = f"groupher_server_{purpose}"
                connection = ["-h", "127.0.0.1", "-p", str(port), "-U", "postgres"]
                subprocess.run(["createdb", *connection, database], check=True, env=environment)
                subprocess.run(
                    ["psql", "-X", "-q", "-v", "ON_ERROR_STOP=1", *connection, "-d", database,
                     "-c", "CREATE TABLE isolation_probe (value text); INSERT INTO isolation_probe VALUES ('preserved')"],
                    check=True,
                    env=environment,
                )
                guarded_environment = dict(
                    environment,
                    MIX_ENV=purpose,
                    DB_NAME=database,
                    DB_HOST="127.0.0.1",
                    DB_PORT=str(port),
                    TEST_DB_NAME=database,
                    TEST_DB_PORT=str(port),
                )
                for task in ("ecto.drop", "ecto.reset"):
                    refusal = subprocess.run(
                        ["mix", task],
                        cwd=copied,
                        env=guarded_environment,
                        text=True,
                        stdout=subprocess.PIPE,
                        stderr=subprocess.STDOUT,
                        timeout=60,
                        check=False,
                    )
                    if refusal.returncode == 0 or "Refusing to drop an unowned or primary" not in refusal.stdout:
                        raise RuntimeError(f"{purpose} {task} was not refused before deletion: {refusal.stdout[-2000:]}")
                probe = subprocess.run(
                    ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", *connection, "-d", database,
                     "-c", "SELECT value FROM isolation_probe"],
                    check=True,
                    env=environment,
                    text=True,
                    stdout=subprocess.PIPE,
                )
                if probe.stdout.strip() != "preserved":
                    raise RuntimeError(f"{purpose} database probe changed during refusal tests")
            print("Primary dev/test drop and reset refused; both probes preserved.", flush=True)
        environment.update(
            MIX_ENV="test",
            TEST_DB_NAME="groupher_seed_concurrency",
            TEST_DB_PORT=str(port),
            TEST_SEED_CONCURRENCY="1",
            MIX_DEBUG="1",
        )
        with timed("Run mix test (includes compilation and migrations)"):
            result = subprocess.run(
                ["mix", "test", "test/groupher_server/managed_publish_config_test.exs",
                 "test/groupher_server/local_seed_concurrency_test.exs",
                 "test/groupher_server/local_test_articles_test.exs",
                 "test/groupher_server/local_test_actors_grants_test.exs",
                 "test/groupher_server/local_test_actors_guard_test.exs"],
                cwd=copied,
                env=environment,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                timeout=300,
                check=False,
            )
        # The test alias runs compilation and migrations in this same invocation.
        output = []
        for line in result.stdout.splitlines():
            if line.startswith(("<- Ran mix compile in ", "<- Ran mix ecto.migrate in ")):
                print(f"[timing] {line.removeprefix('<- Ran mix ')}", flush=True)
            elif not line.startswith(("-> Running mix ", "<- Ran mix ")):
                output.append(line)
        print("\n".join(output[-40:]), flush=True)
        result.check_returncode()
    finally:
        with timed("Stop PostgreSQL and remove the isolated checkout"):
            if started:
                try:
                    subprocess.run(
                        ["pg_ctl", "-D", str(data), "-m", "fast", "-w", "stop"],
                        check=True,
                        env=environment,
                        stdout=subprocess.DEVNULL,
                    )
                    stopped = True
                except (OSError, subprocess.CalledProcessError):
                    print(f"Could not stop the disposable cluster; retained: {temporary}", file=sys.stderr)
                    raise
            if not started or stopped:
                shutil.rmtree(temporary)
                print("Disposable cluster and copied backend removed.", flush=True)


if __name__ == "__main__":
    with timed("Total"):
        main()
