defmodule GroupherServer.CMS.Dashboard.LinkValidator do
  @moduledoc false

  def valid_tree?(%{id: id, type: type, title: title} = item)
      when is_binary(id) and is_binary(title) do
    case type do
      :link -> is_binary(Map.get(item, :url))
      :group -> valid_children?(Map.get(item, :links, []))
      _ -> false
    end
  end

  def valid_tree?(_), do: false

  def valid_children?(links) when is_list(links) do
    Enum.all?(links, fn
      %{id: id, title: title, url: url} ->
        is_binary(id) and is_binary(title) and is_binary(url)

      _ ->
        false
    end)
  end

  def valid_children?(_), do: false
end
