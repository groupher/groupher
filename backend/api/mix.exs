defmodule GroupherServer.Mixfile do
  @moduledoc false

  use Mix.Project

  def project do
    [
      app: :groupher_server,
      version: "2.1.10",
      elixir: "~> 1.20",
      elixirc_paths: elixirc_paths(Mix.env()),
      compilers: Mix.compilers() ++ [:error_cat],
      dialyzer: [plt_add_deps: :app_tree, ignore_warnings: ".dialyzer_ignore.exs"],
      test_coverage: [tool: ExCoveralls],
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps(),
      listeners: [Phoenix.CodeReloader]
    ]
  end

  def cli do
    [
      preferred_envs: [
        coveralls: :test,
        "coveralls.detail": :test,
        "coveralls.post": :test,
        "coveralls.html": :test
      ]
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {GroupherServer.Application, []},
      extra_applications: [
        :corsica,
        :ex_unit,
        :logger,
        :runtime_tools,
        :sentry
      ]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test"]
  defp elixirc_paths(:seed_prod), do: ["lib", "test/support"]
  defp elixirc_paths(:dev), do: ["lib", "test/support", "dev"]
  defp elixirc_paths(_), do: ["lib", "test/support"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:phoenix, "~> 1.8"},
      {:phoenix_pubsub, "~> 2.4"},
      {:phoenix_html, "~> 4.4"},
      {:phoenix_live_view, "~> 1.2.15"},
      {:phoenix_live_reload, "~> 1.7.0", only: :dev},
      {:phoenix_live_dashboard, "~> 0.9.1"},
      {:ecto_sql, "~> 3.14.0"},
      {:phoenix_ecto, "~> 4.7.0"},
      {:postgrex, "~> 0.23.0"},
      # for i18n usage
      {:gettext, "~> 1.0"},
      {:plug_cowboy, "~> 2.9.0"},
      {:plug, "~> 1.20"},
      # GraphQl tool
      {:absinthe, "~> 1.11"},
      # Plug support for Absinthe
      {:absinthe_plug, "~> 1.5.10"},
      # Password hashing lib
      {:comeonin, "~> 5.5"},
      # CORS
      {:corsica, "~> 2.1.3"},
      {:tesla, "~> 1.23"},
      {:finch, "~> 0.25"},
      {:flop, "~> 0.29.1"},
      {:guardian, "~> 2.5"},
      {:dataloader, "~> 2.0.2"},
      {:mix_test_watch, "~> 1.4.0", only: :dev, runtime: false},
      {:ex_unit_notifier, "~> 1.3", only: :test},
      {:pre_commit, "~> 0.3.4"},
      {:inch_ex, "~> 2.0", only: [:dev, :test]},
      {:short_maps, "~> 0.1.2"},
      {:jason, "~> 1.4"},
      {:rfc8785, "1.1.0"},
      {:credo, "1.7.19", only: [:dev, :test], runtime: false},
      {:bunt, "~> 1.0", only: [:dev, :test], override: true},
      {:dialyxir, "~> 1.4", only: :dev, runtime: false},
      {:excoveralls, "~> 0.18", only: :test},
      {:sentry, "~> 14.0"},
      {:recase, "~> 0.9.1"},
      {:nanoid, "~> 2.1.0"},
      # mem cache
      {:cachex, "~> 4.1"},
      # postgres-backed job queue
      {:oban, "~> 2.24"},
      # OTP 29 compatibility fix landed upstream after the latest Hex release.
      {:quantum,
       git: "https://github.com/quantum-elixir/quantum-core.git",
       ref: "f6d838cbdc9f8893653df33f6a0f89c4e42768a3"},
      {:accessible, "~> 0.3.0"},
      {:floki, "~> 0.38.5"},
      {:req, "~> 0.7.5"},
      # rss feed parser
      {:fiet, "~> 0.3"},
      {:ogp, "~> 1.1.2"},
      {:dns_cluster, "~> 0.3"},
      {:bandit, "~> 1.15"},
      {:esbuild, "~> 0.10", runtime: Mix.env() == :dev},
      {:ex_const, "~> 0.3.0"},
      {:tailwind, "~> 0.5", runtime: Mix.env() == :dev},
      {:heroicons,
       github: "tailwindlabs/heroicons",
       tag: "v2.1.1",
       sparse: "optimized",
       app: false,
       compile: false,
       depth: 1}
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to create, migrate and run the seeds file at once:
  #
  #     $ mix ecto.setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      "ecto.setup": ["ecto.create", "ecto.migrate"],
      "ecto.drop": &guarded_ecto_drop/1,
      "ecto.reset": &guarded_ecto_reset/1,
      test: ["ecto.create --quiet", "ecto.migrate", "test"],
      "test.coverage": ["coveralls.html"],
      "test.coverage.short": ["coveralls"],
      "doc.report": ["inch.report"],
      "lint.context": [
        "cmd node --test ../../scripts/check-backend-context-v2.test.mjs",
        "cmd node ../../scripts/check-backend-context-v2.mjs --fully-strict"
      ],
      "lint.style": [
        "cmd node ../../scripts/check-elixir-module-style.mjs",
        "cmd elixir scripts/rewrite_wrapped_inline_do.exs --check lib test"
      ],
      lint: [
        "lint.style",
        "lint.context",
        "credo --strict"
      ],
      "lint.static": ["dialyzer --format dialyxir"],
      sentry_recompile: ["compile", "deps.compile sentry --force"],
      "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
      "assets.build": ["tailwind groupher_server", "esbuild groupher_server"],
      "assets.deploy": [
        "tailwind groupher_server --minify",
        "esbuild groupher_server --minify",
        "phx.digest"
      ]
    ]
  end

  defp guarded_ecto_drop(args) do
    Mix.Task.run("loadconfig")
    target = Application.get_env(:groupher_server, :managed_database_target)

    cond do
      Mix.env() in [:dev, :test] and target ->
        if Enum.any?(args, &(&1 not in ["--quiet", "--no-compile", "--no-deps-check"])) do
          Mix.raise("Managed database drop does not support force or custom repository options.")
        end

        run_devhub_database!(["drop", "--target", Atom.to_string(Mix.env())])

      Mix.env() in [:dev, :test] ->
        config = Application.get_env(:groupher_server, GroupherServer.Repo, [])
        database = config[:database]

        temporary? =
          is_binary(database) and
            (String.starts_with?(database, "groupher_migration_smoke_") or
               String.starts_with?(database, "groupher_passport_ref_migration_")) and
            not File.exists?(
              Path.expand("../../local/dev-hub/config/checkout-claim.json", __DIR__)
            )

        unless temporary? and config[:hostname] in ["localhost", "127.0.0.1", "::1"] and
                 is_nil(config[:url]) do
          Mix.raise("Refusing to drop an unowned or primary development database.")
        end

        Mix.Task.run("ecto.drop", args)

      true ->
        Mix.Task.run("ecto.drop", args)
    end
  end

  defp guarded_ecto_reset(args) do
    Mix.Task.run("loadconfig")

    if Mix.env() in [:dev, :test] and
         Application.get_env(:groupher_server, :managed_database_target) do
      guarded_ecto_drop(args)
      run_devhub_database!(["create", "--target", Atom.to_string(Mix.env())])
      Mix.Task.run("ecto.migrate", [])
    else
      guarded_ecto_drop(args)
      Mix.Task.run("ecto.setup", [])
    end
  end

  defp run_devhub_database!(args) do
    {_, status} =
      System.cmd("pnpm", ["devhub", "db" | args],
        cd: Path.expand("../..", __DIR__),
        into: IO.stream(:stdio, :line),
        stderr_to_stdout: true
      )

    if status != 0, do: Mix.raise("Managed database operation failed.")
    :ok
  end
end
