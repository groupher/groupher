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
      raise "Usage: mix run scripts/delete_full_community.exs -- <slug>"
  end

IO.puts("Deleting full community with slug: #{slug}")

case GroupherServer.CMS.Seeds.delete_full_community(slug) do
  {:ok, :ok} ->
    IO.puts("✓ Full community deleted successfully!")
    IO.puts("  slug: #{slug}")
    IO.puts("! background_jobs were not truncated automatically.")
    IO.puts("  If needed, clean up only community-specific jobs manually.")

  {:error, reason} ->
    IO.puts("✗ Failed to delete full community: #{inspect(reason)}")
    System.halt(1)
end
