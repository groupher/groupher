defmodule GroupherServer.CMS.Interactions.ViewerState do
  @moduledoc """
  Builds typed viewer-facing state without returning a modified Artiment.

      Article / Comment Reader
        -> Interactions.ViewerState
        -> projection-backed typed state
        -> response assembler

  The current implementation reuses the existing batched State reader while
  callers migrate. The returned contract is already independent from Ecto
  Article/Comment structs.
  """

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.{Config, Matcher}
  alias GroupherServer.CMS.Interactions.State
  alias __MODULE__.{Article, ArticleReport, Comment, CommentReport, Emotion}

  @doc "Returns typed Interaction state for one Artiment and optional viewer."
  @spec one(struct(), User.t() | nil, keyword()) :: struct()
  def one(artiment, viewer, opts \\ []) do
    artiment
    |> State.read(viewer, opts)
    |> build(opts)
  end

  @doc "Returns typed Interaction states keyed by `{artiment_type, physical_id}`."
  @spec many([struct()], User.t() | nil, keyword()) :: %{
          optional({atom(), integer()}) => struct()
        }
  def many(artiments, viewer, opts \\ []) when is_list(artiments) do
    artiments
    |> Enum.group_by(fn artiment ->
      case Matcher.match_interaction(artiment) do
        {:ok, %{artiment: type}} -> type
        _ -> :unsupported
      end
    end)
    |> Enum.reduce(%{}, fn
      {:unsupported, _entries}, acc ->
        acc

      {type, entries}, acc ->
        read_type = if type == :comment, do: :comment, else: type

        read_type
        |> State.read(entries, viewer, opts)
        |> Enum.reduce(acc, fn hydrated, states ->
          Map.put(states, {type, hydrated.id}, build(hydrated, opts))
        end)
    end)
  end

  defp build(%GroupherServer.CMS.Model.Comment{} = comment, opts) do
    fields = %{
      upvotes_count: value(comment, :upvotes_count, 0),
      latest_upvoted_users: value(comment, :latest_upvoted_users, []),
      emotions: emotions(comment, :comment),
      viewer_has_upvoted: value(comment, :viewer_has_upvoted, false),
      viewer_has_reported: value(comment, :viewer_has_reported, false)
    }

    if Keyword.get(opts, :surface) == :report do
      struct(CommentReport, Map.put(fields, :reported_count, reported_count(comment)))
    else
      struct(Comment, fields)
    end
  end

  defp build(article, opts) do
    fields = %{
      upvotes_count: value(article, :upvotes_count, 0),
      collects_count: value(article, :collects_count, 0),
      latest_upvoted_users: value(article, :latest_upvoted_users, []),
      latest_collected_users: value(article, :latest_collected_users, []),
      emotions: emotions(article, :article),
      viewer_has_upvoted: value(article, :viewer_has_upvoted, false),
      viewer_has_collected: value(article, :viewer_has_collected, false),
      viewer_has_reported: value(article, :viewer_has_reported, false),
      viewer_has_viewed: value(article, :viewer_has_viewed, false)
    }

    if Keyword.get(opts, :surface) == :report do
      struct(ArticleReport, Map.put(fields, :reported_count, reported_count(article)))
    else
      struct(Article, fields)
    end
  end

  defp emotions(artiment, kind) do
    vocabulary = if kind == :article, do: Config.emotions(), else: Config.comment_emotions()
    state = value(artiment, :emotions, %{})

    Enum.map(vocabulary, fn emotion ->
      %Emotion{
        emotion: emotion,
        count: value(state, :"#{emotion}_count", 0),
        latest_users: value(state, :"latest_#{emotion}_users", []),
        viewer_has_reacted: value(state, :"viewer_has_#{emotion}ed", false)
      }
    end)
  end

  defp reported_count(artiment) do
    value(artiment, :reported_count, value(value(artiment, :meta, %{}), :reported_count, 0))
  end

  defp value(data, key, default) when is_map(data), do: Map.get(data, key, default) || default
  defp value(_data, _key, default), do: default
end
