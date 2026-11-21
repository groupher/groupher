reset? = "--reset" in System.argv()

endpoint_config =
  Application.get_env(:groupher_server, GroupherServerWeb.Endpoint, [])
  |> Keyword.put(:server, false)

Application.put_env(:groupher_server, GroupherServerWeb.Endpoint, endpoint_config)

repo_config =
  Application.get_env(:groupher_server, GroupherServer.Repo, [])
  |> Keyword.put(:pool_size, 1)

Application.put_env(:groupher_server, GroupherServer.Repo, repo_config)

oban_config =
  Application.get_env(:groupher_server, Oban, [])
  |> Keyword.put(:testing, :manual)
  |> Keyword.put(:plugins, false)
  |> Keyword.put(:queues, false)

Application.put_env(:groupher_server, Oban, oban_config)

case Application.ensure_all_started(:groupher_server) do
  {:ok, _apps} ->
    :ok

  {:error, reason} ->
    IO.puts("✗ Failed to start groupher_server: #{inspect(reason)}")
    System.halt(1)
end

cache_pool =
  Application.get_env(:groupher_server, :cache)
  |> Keyword.fetch!(:pool)

cache_pool
|> Enum.each(fn {key, %{name: name}} ->
  case Process.whereis(name) do
    nil -> {:ok, _pid} = Cachex.start_link(name, Helper.Cache.config(key))
    _pid -> :ok
  end
end)

IO.puts("Seeding lite home community#{if reset?, do: " with reset", else: ""}")

result =
  [command_id_factory: &Ecto.UUID.generate/0]
  |> then(fn seed_opts ->
    if reset? do
      GroupherServer.CMS.Seeds.LiteHome.reset_and_seed(seed_opts)
    else
      GroupherServer.CMS.Seeds.LiteHome.seed(seed_opts)
    end
  end)

case result do
  {:ok, community} ->
    summary = Map.get(community, :seed_summary, %{})
    IO.puts("✓ Lite home community seeded successfully!")
    IO.puts("  slug: #{community.slug}")
    IO.puts("  id: #{community.id}")
    IO.puts("  posts: #{Map.get(summary, :posts, "?")}")
    IO.puts("  kanban_posts: #{Map.get(summary, :kanban_posts, "?")}")
    IO.puts("  changelogs: #{Map.get(summary, :changelogs, "?")}")
    IO.puts("  docs: #{Map.get(summary, :docs, "?")}")

  {:error, reason} ->
    IO.puts("✗ Failed to seed lite home community: #{inspect(reason)}")
    System.halt(1)
end
