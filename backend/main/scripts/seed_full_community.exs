slug =
  case System.argv() do
    [s | _] ->
      if s == "--" or String.starts_with?(s, "-") do
        raise "Invalid slug: '#{s}'. Slug cannot start with '-' or be '--'."
      end

      if String.contains?(s, " ") do
        raise "Invalid slug: '#{s}'. Slug cannot contain spaces."
      end

      if Helper.Validator.Slug.valid?(s) do
        s
      else
        raise "Invalid slug: '#{s}'. Use lowercase letters, numbers, hyphen and underscore."
      end

    _ ->
      raise "Usage: mix run scripts/seed_full_community.exs -- <slug>"
  end

IO.puts("Creating full community with slug: #{slug}")

case GroupherServer.CMS.Seeds.full_community(slug) do
  {:ok, community} ->
    IO.puts("✓ Full community created successfully!")
    IO.puts("  slug: #{community.slug}")
    IO.puts("  id: #{community.id}")

  {:error, reason} ->
    IO.puts("✗ Failed to create full community: #{inspect(reason)}")
    System.halt(1)
end
