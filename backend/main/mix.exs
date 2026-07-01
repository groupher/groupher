defmodule GroupherServer.Mixfile do
  @moduledoc false

  use Mix.Project

  def project do
    [
      app: :groupher_server,
      version: "2.1.10",
      elixir: "~> 1.19",
      elixirc_paths: elixirc_paths(Mix.env()),
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
        :scrivener_ecto,
        :sentry
      ]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test"]
  defp elixirc_paths(:mock), do: ["lib", "test/support"]
  defp elixirc_paths(:seed_prod), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib", "test/support"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:phoenix, "~> 1.8.4"},
      {:phoenix_pubsub, "~> 2.2"},
      {:phoenix_html, "~> 4.3"},
      {:phoenix_live_view, "~> 1.1.25"},
      {:phoenix_live_reload, "~> 1.6.2", only: :mock},
      {:phoenix_live_dashboard, "~> 0.8.7"},
      {:ecto_sql, "~> 3.13.5"},
      {:phoenix_ecto, "~> 4.7.0"},
      {:postgrex, "~> 0.22.0"},
      # for i18n usage
      {:gettext, "~> 1.0"},
      {:plug_cowboy, "~> 2.8.0"},
      {:plug, "~> 1.19"},
      # GraphQl tool
      {:absinthe, "~> 1.10"},
      # Plug support for Absinthe
      {:absinthe_plug, "~> 1.5.9"},
      # Password hashing lib
      {:comeonin, "~> 5.5"},
      # CORS
      {:corsica, "~> 2.1.3"},
      {:tesla, "~> 1.17"},
      # optional, but recommended adapter
      {:hackney, "~> 1.25"},
      {:scrivener_ecto, "~> 3.1.0"},
      # enhanced cursor based pagination
      {:quarto, "~> 1.1.7"},
      {:guardian, "~> 2.4.0"},
      {:dataloader, "~> 2.0.2"},
      {:mix_test_watch, "~> 1.4.0", only: :dev, runtime: false},
      {:ex_unit_notifier, "~> 1.3", only: :test},
      {:pre_commit, "~> 0.3.4"},
      {:inch_ex, "~> 2.0", only: [:dev, :test]},
      {:short_maps, "~> 0.1.2"},
      {:jason, "~> 1.4"},
      {:credo, "1.7.18", only: [:dev, :test], runtime: false},
      {:bunt, "~> 1.0", only: [:dev, :test], override: true},
      {:dialyxir, "~> 1.4", only: [:dev, :mock], runtime: false},
      {:excoveralls, "~> 0.18", only: :test},
      {:sentry, "~> 13.0"},
      {:recase, "~> 0.9.1"},
      {:nanoid, "~> 2.1.0"},
      # mem cache
      {:cachex, "~> 4.1"},
      # postgres-backed job queue
      {:rihanna, "1.3.5"},
      # cron-like scheduler job
      {:quantum, "~> 3.5"},
      {:html_sanitize_ex, "~> 1.4"},
      {:earmark, "~> 1.4.13"},
      {:accessible, "~> 0.3.0"},
      {:floki, "~> 0.38"},
      {:httpoison, "~> 2.3.0"},
      # rss feed parser
      {:fiet, "~> 0.3"},
      {:ogp, "~> 1.1.2"},
      {:dns_cluster, "~> 0.2.0"},
      {:bandit, "~> 1.10"},
      {:esbuild, "~> 0.10", runtime: Mix.env() == :mock},
      {:ex_const, "~> 0.3.0"},
      {:tailwind, "~> 0.4", runtime: Mix.env() == :mock},
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
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate", "test"],
      "test.coverage": ["coveralls.html"],
      "test.coverage.short": ["coveralls"],
      "doc.report": ["inch.report"],
      lint: ["credo --strict"],
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
end
