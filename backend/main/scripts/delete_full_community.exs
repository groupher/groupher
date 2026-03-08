slug =
  case System.argv() do
    [s] ->
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

  {:error, reason} ->
    IO.puts("✗ Failed to delete full community: #{inspect(reason)}")
    System.halt(1)
end
