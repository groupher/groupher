reset? = "--reset" in System.argv()

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
  if reset? do
    GroupherServer.CMS.Seeds.LiteHome.reset_and_seed()
  else
    GroupherServer.CMS.Seeds.LiteHome.seed()
  end

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
