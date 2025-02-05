defmodule GroupherServer.Mixfile do
  @moduledoc false

  use Mix.Project

  def project do
    [
      app: :groupher_server,
      version: "2.1.6",
      elixir: "~> 1.9",
      elixirc_paths: elixirc_paths(Mix.env()),
      dialyzer: [plt_add_deps: :transitive, ignore_warnings: ".dialyzer_ignore.exs"],
      test_coverage: [tool: ExCoveralls],
      preferred_cli_env: [
        coveralls: :test,
        "coveralls.detail": :test,
        "coveralls.post": :test,
        "coveralls.html": :test
      ],
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
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
        :faker,
        :scrivener_ecto,
        :timex,
        :sentry
      ]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(:mock), do: ["lib", "priv/mock", "test/support"]
  defp elixirc_paths(_), do: ["lib", "test/support"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:phoenix, "~> 1.7.11"},
      {:phoenix_pubsub, "~> 2.0"},
      {:phoenix_html, "~> 4.0"},
      {:phoenix_live_view, "~> 0.20.2"},
      {:phoenix_live_reload, "~> 1.2", only: :mock},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      {:ecto_sql, "~> 3.10.1"},
      {:phoenix_ecto, "~> 4.5.1"},
      {:postgrex, "~> 0.17.3"},
      # for i18n usage
      {:gettext, "~> 0.23.1"},
      {:plug_cowboy, "~> 2.7.0"},
      {:plug, "~> 1.15"},
      # GraphQl tool
      {:absinthe, "~> 1.7.4"},
      # Plug support for Absinthe
      {:absinthe_plug, "~> 1.5.8"},
      # Password hashing lib
      {:comeonin, "~> 5.3.2"},
      # CORS
      {:corsica, "~> 2.1.2"},
      {:tesla, "~> 1.7.0"},
      # optional, but recommended adapter
      {:hackney, "~> 1.8"},
      # only used for tesla's JSON-encoder
      {:poison, "~> 4.0.1"},
      # for fake data in test env
      {:faker, "~> 0.17.0"},
      {:scrivener_ecto, "~> 2.7.0"},
      # enhanced cursor based pagination
      {:quarto, "~> 1.1.5"},
      {:guardian, "~> 2.3.2"},
      {:timex, "~> 3.7.11"},
      {:dataloader, "~> 2.0.0"},
      {:mix_test_watch, "~> 1.0.2", only: :dev, runtime: false},
      {:ex_unit_notifier, "~> 1.0", only: :test},
      {:pre_commit, "~> 0.3.4"},
      {:inch_ex, "~> 2.0", only: [:dev, :test]},
      {:short_maps, "~> 0.1.2"},
      {:jason, "~> 1.2"},
      {:credo, "~> 1.5.5", only: [:dev, :test], runtime: false},
      {:dialyxir, "~> 1.1.0", only: [:dev, :mock], runtime: false},
      {:excoveralls, "~> 0.8", only: :test},
      {:sentry, "~> 8.0"},
      {:recase, "~> 0.7.0"},
      {:nanoid, "~> 2.0.5"},
      # mailer
      {:bamboo, "2.3.0"},
      # mem cache
      {:cachex, "3.3.0"},
      # postgres-backed job queue
      {:rihanna, "1.3.5"},
      # cron-like scheduler job
      {:quantum, "~> 2.3"},
      {:html_sanitize_ex, "~> 1.3"},
      {:earmark, "~> 1.4.13"},
      {:accessible, "~> 0.3.0"},
      {:floki, "~> 0.30.1"},
      {:httpoison, "~> 1.8"},
      # rss feed parser
      {:fiet, "~> 0.3"},
      {:ogp, "~> 1.0.0"},
      {:ex_aliyun_openapi, "0.8.4"},
      {:dns_cluster, "~> 0.1.1"},
      {:bandit, "~> 1.2"},
      {:aliyun_oss, "~> 2.0"},
      {:esbuild, "~> 0.8", runtime: Mix.env() == :mock},
      {:tailwind, "~> 0.2", runtime: Mix.env() == :mock},
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
      "cps.seeds": ["run priv/mock/cps_seeds.exs"],
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
