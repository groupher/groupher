defmodule GroupherServer.CMS.Articles.Publishable do
  @moduledoc """
  Validates saved Article content at the publication boundary.

  WorkingCopies may be empty while editing. Both a WorkingCopy and a frozen
  Snapshot use this validator immediately before the public selection changes.

      saved WorkingCopy or Snapshot -> title / Plate content validation -> publish or invalid_body
  """

  alias GroupherServer.CMS

  alias CMS.Model.{ArticleSnapshot, ArticleWorkingCopy}

  @visible_node_types ~w(image img attachment file embed iframe table video audio)

  @doc """
  Returns `{:ok, :pass}` only when the saved title and Plate document meet the publish contract.
  """
  def validate(%ArticleWorkingCopy{} = work) do
    validate_fields(work.title, CMS.Articles.Body.document(work).json)
  end

  def validate(%ArticleSnapshot{} = snapshot) do
    validate_fields(snapshot.title, CMS.Articles.Body.document(snapshot).json)
  end

  def validate(%{title: title, body_json: body_json}), do: validate_fields(title, body_json)

  def validate(_), do: {:error, :invalid_body}

  defp validate_fields(title, body_json) when is_binary(title) and is_binary(body_json) do
    with true <- String.trim(title) != "",
         {:ok, value} <- Jason.decode(body_json),
         true <- is_list(value) and visible_content?(value) do
      {:ok, :pass}
    else
      _ -> {:error, :invalid_body}
    end
  end

  defp validate_fields(_title, _body_json), do: {:error, :invalid_body}

  defp visible_content?(nodes) when is_list(nodes), do: Enum.any?(nodes, &visible_content?/1)

  defp visible_content?(%{} = node) do
    text = Map.get(node, "text") || Map.get(node, :text)
    type = Map.get(node, "type") || Map.get(node, :type)

    (is_binary(text) and String.trim(text) != "") or
      (is_binary(type) and String.downcase(type) in @visible_node_types) or
      Enum.any?(Map.values(node), &visible_content?/1)
  end

  defp visible_content?(_), do: false
end
