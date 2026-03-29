defmodule GroupherServer.CMS.Helper.EmotionFormatter do
  @moduledoc """
  Transforms internal emotion embeds into sparse API-facing arrays.

  Example:

      iex> EmotionFormatter.format(
      ...>   %{
      ...>     beer_count: 2,
      ...>     latest_beer_users: [%{login: "alice"}, %{login: "bob"}],
      ...>     viewer_has_beered: true,
      ...>     heart_count: 0
      ...>   },
      ...>   :article
      ...> )
      [
        %{
          type: :beer,
          count: 2,
          viewer_has_reacted: true,
          latest_users: [%{login: "alice"}, %{login: "bob"}]
        }
      ]

  Zero-count emotions are filtered out, so the API only returns the sparse
  set of active reactions instead of every supported reaction type.
  """

  import Helper.Utils, only: [get_config: 2]

  @article_emotions get_config(:article, :emotions)
  @comment_emotions get_config(:article, :comment_emotions)
  @all_emotions (@article_emotions ++ @comment_emotions) |> Enum.uniq()

  @spec format(map() | nil, :article | :comment | nil) :: [map()]
  def format(%{emotions: emotions}, kind), do: format(emotions, kind)
  def format(nil, _kind), do: []
  def format(%_{} = emotions, kind), do: format(Map.from_struct(emotions), kind)

  def format(emotions, kind) when is_map(emotions) do
    supported_emotions(kind)
    |> Enum.reduce([], fn emotion, acc ->
      count = Map.get(emotions, :"#{emotion}_count", 0) || Map.get(emotions, "#{emotion}_count", 0)

      if count > 0 do
        latest_users =
          Map.get(emotions, :"latest_#{emotion}_users", []) ||
            Map.get(emotions, "latest_#{emotion}_users", [])

        viewer_has_reacted =
          Map.get(emotions, :"viewer_has_#{emotion}ed", false) ||
            Map.get(emotions, "viewer_has_#{emotion}ed", false)

        acc ++
          [
            %{
              type: emotion,
              count: count,
              viewer_has_reacted: viewer_has_reacted,
              latest_users: latest_users
            }
          ]
      else
        acc
      end
    end)
    |> Enum.sort_by(fn %{count: count, type: type} -> {-count, Atom.to_string(type)} end)
  end

  defp supported_emotions(:article), do: @article_emotions
  defp supported_emotions(:comment), do: @comment_emotions
  defp supported_emotions(_), do: @all_emotions
end
