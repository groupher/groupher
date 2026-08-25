defmodule GroupherServer.CMS.Events.Helper do
  @moduledoc """
  Normalizes event payload fragments before CMS event handlers consume them.

  It currently consolidates repeated mention/citation targets while preserving
  first-seen ordering and all block locations.

  Business position:

      Domain write
        -> CMS.Events
        -> Helper
        -> bounded side effect
  """

  @doc """
  Merges repeated targets and combines their block locations.

  For example:
  [
    %{
      block_linker: ["block-zByQI"],
      [group_key]: 190057,
      ..
    },
    %{
      block_linker: ["block-zByQI", "block-ZgKJs"],
      [group_key]: 190057,
      ..
    },
  ]
  """
  @spec merge_same_block_linker([map()], atom()) :: [map()]
  def merge_same_block_linker(contents, group_key) do
    {keys, contents_by_key} =
      Enum.reduce(contents, {[], %{}}, fn content, {keys, contents_by_key} ->
        key = Map.get(content, group_key)
        content = Map.update!(content, :block_linker, &Enum.reverse/1)

        case Map.fetch(contents_by_key, key) do
          :error ->
            {[key | keys], Map.put(contents_by_key, key, content)}

          {:ok, existing} ->
            merged =
              Map.update!(existing, :block_linker, fn block_linker ->
                content.block_linker ++ block_linker
              end)

            {keys, Map.put(contents_by_key, key, merged)}
        end
      end)

    keys
    |> Enum.reverse()
    |> Enum.map(fn key ->
      contents_by_key
      |> Map.fetch!(key)
      |> Map.update!(:block_linker, &Enum.reverse/1)
    end)
  end
end
