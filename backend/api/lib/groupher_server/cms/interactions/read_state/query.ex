defmodule GroupherServer.CMS.Interactions.ReadState.Query do
  @moduledoc """
  Reads batched, derived Interaction state without loading reaction fact rows.

  Anonymous reads deliberately compile no bitmap membership expressions.

      ReadState -> Query -> DefaultViewerState + projection rows
  """

  require GroupherServer.CMS.Model.Interaction.RoaringBitmap
  require GroupherServer.CMS.Interactions.ErrorCat

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Articles
  alias CMS.Artiment.Matcher
  alias CMS.Helper.EmotionFormatter
  alias CMS.Interactions.{Config, DefaultViewerState, ErrorCat, Reactions, ReadState}
  alias CMS.Model.Interaction.RoaringBitmap

  @article_threads Config.article_threads()
  @supported_threads [:comment | @article_threads]

  @doc """
  Returns Interaction read state for one Artiment.

  ## Examples

      ReadState.Query.viewer_state(article, viewer)

  """
  @spec viewer_state(struct(), User.t() | nil, keyword()) :: map() | {:error, term()}
  def viewer_state(artiment, viewer, opts \\ []) do
    with {:ok, %{artiment: type} = info} <- Matcher.match_interaction(artiment),
         target_id when is_integer(target_id) or is_binary(target_id) <- Map.get(artiment, :id),
         state when is_map(state) <-
           info
           |> viewer_rows(type, [target_id], viewer, opts)
           |> Map.get(target_id) do
      build(state, type, opts)
    else
      {:error, _reason} = error -> error
      _ -> {:error, ErrorCat.unsupported_artiment()}
    end
  end

  @doc """
  Returns batched Interaction states keyed by Artiment identity.

  ## Examples

      ReadState.Query.viewer_states([article, comment], viewer)

  """
  @spec viewer_states([struct()], User.t() | nil, keyword()) :: map() | {:error, term()}
  def viewer_states(artiments, viewer, opts \\ []) when is_list(artiments) do
    with {:ok, typed_artiments} <- match_all(artiments) do
      typed_artiments
      |> Enum.group_by(
        fn {type, artiment} ->
          {:ok, info} = Matcher.match_interaction(artiment)
          {type, info.foreign_key}
        end,
        &elem(&1, 1)
      )
      |> Enum.reduce(%{}, fn {{type, _identity}, entries}, acc ->
        ids = Enum.map(entries, & &1.id)
        {:ok, info} = entries |> hd() |> Matcher.match_interaction()
        rows = viewer_rows(info, type, ids, viewer, opts)

        Enum.reduce(entries, acc, fn artiment, states ->
          Map.put(states, {type, artiment.id}, build(Map.fetch!(rows, artiment.id), type, opts))
        end)
      end)
    end
  end

  @doc """
  Resolves public Article paths and returns the ordered private Interaction
  projection used to reconcile confirmed writes.

  Invalid or non-visible paths are omitted by the Article path reader.
  """
  @spec article_states_for_paths([map()], User.t(), keyword()) ::
          {:ok, [map()]} | {:error, term()}
  def article_states_for_paths(paths, %User{} = viewer, opts \\ []) when is_list(paths) do
    with {:ok, resolved} <- Articles.resolve_paths(paths),
         states when is_map(states) <-
           viewer_states(Enum.map(resolved, & &1.article), viewer, opts) do
      {:ok,
       Enum.map(resolved, fn %{path: path, article: article, relation: relation} ->
         {:ok, %{artiment: type}} = Matcher.match_interaction(article)
         state = Map.fetch!(states, {type, article.id})

         ReadState.article_state(
           %{community: path.community, thread: path.thread, inner_id: relation.inner_id},
           state
         )
       end)}
    end
  end

  @doc "Returns public presentation state without viewer bitmap membership checks."
  @spec public_state(struct(), keyword()) :: map() | {:error, term()}
  def public_state(artiment, opts \\ []), do: viewer_state(artiment, nil, opts)

  @doc "Returns batched public presentation state without viewer bitmap membership checks."
  @spec public_states([struct()], keyword()) :: map() | {:error, term()}
  def public_states(artiments, opts \\ []), do: viewer_states(artiments, nil, opts)

  @doc """
  Returns fixed reaction counts keyed by Artiment identity.

  ## Examples

      ReadState.Query.counts([article, comment])

  """
  @spec counts([struct()]) :: map() | {:error, term()}
  def counts(artiments) when is_list(artiments) do
    with {:ok, typed_artiments} <- match_all(artiments) do
      typed_artiments
      |> Enum.group_by(
        fn {type, artiment} ->
          {:ok, info} = Matcher.match_interaction(artiment)
          {type, info.foreign_key}
        end,
        &elem(&1, 1)
      )
      |> Enum.reduce(%{}, fn {{type, _identity}, entries}, acc ->
        ids = Enum.map(entries, & &1.id)
        projection_type = if type == :comment, do: :comment, else: :article
        {:ok, info} = entries |> hd() |> Matcher.match_interaction()

        emotion_values =
          emotion_stats_by_target(info, ids, nil, projection_type)

        info
        |> fixed_counts_for(ids)
        |> Enum.reduce(acc, fn {id, values}, counts_by_artiment ->
          emotion_counts =
            emotion_values
            |> Map.get(id, %{})
            |> EmotionFormatter.counts(projection_type)

          Map.put(
            counts_by_artiment,
            {type, id},
            Map.put(values, :emotion_counts, emotion_counts)
          )
        end)
      end)
    end
  end

  defp viewer_rows(info, thread, target_ids, viewer, opts)
       when thread in @supported_threads and is_list(target_ids) do
    target_ids = Enum.uniq(target_ids)
    projection_type = if thread == :comment, do: :comment, else: :article
    fixed_by_target = fixed_stats_by_target(info, target_ids, viewer, opts)
    emotions_by_target = emotion_stats_by_target(info, target_ids, viewer, projection_type)

    Map.new(target_ids, fn target_id ->
      state =
        info
        |> empty_state()
        |> Map.merge(Map.get(fixed_by_target, target_id, %{}))
        |> Map.put(:emotions, Map.get(emotions_by_target, target_id, %{}))

      {target_id, state}
    end)
  end

  defp match_all(artiments) do
    Enum.reduce_while(artiments, {:ok, []}, fn artiment, {:ok, acc} ->
      case Matcher.match_interaction(artiment) do
        {:ok, %{artiment: type}} -> {:cont, {:ok, [{type, artiment} | acc]}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, typed_artiments} -> {:ok, Enum.reverse(typed_artiments)}
      {:error, _reason} = error -> error
    end
  end

  defp build(state, :comment, opts) do
    DefaultViewerState.comment()
    |> Map.merge(%{
      upvotes_count: value(state, :upvotes_count, 0),
      interaction_revision: value(state, :interaction_revision, 0),
      latest_upvoted_users: value(state, :latest_upvoted_users, []),
      emotions: emotions(state, :comment),
      viewer_has_upvoted: value(state, :viewer_has_upvoted, false),
      viewer_has_reported: value(state, :viewer_has_reported, false)
    })
    |> maybe_add_report(state, opts)
  end

  defp build(state, type, opts) when type in @article_threads do
    DefaultViewerState.article()
    |> Map.merge(%{
      upvotes_count: value(state, :upvotes_count, 0),
      interaction_revision: value(state, :interaction_revision, 0),
      collects_count: value(state, :collects_count, 0),
      latest_upvoted_users: value(state, :latest_upvoted_users, []),
      latest_collected_users: value(state, :latest_collected_users, []),
      emotions: emotions(state, :article),
      viewer_has_upvoted: value(state, :viewer_has_upvoted, false),
      viewer_has_collected: value(state, :viewer_has_collected, false),
      viewer_emotion: viewer_emotion(state, :article),
      viewer_has_reported: value(state, :viewer_has_reported, false)
    })
    |> maybe_add_report(state, opts)
  end

  defp viewer_emotion(state, projection_type) do
    state
    |> emotions(projection_type)
    |> Enum.find_value(fn emotion ->
      if emotion.viewer_has_reacted, do: emotion.emotion
    end)
  end

  defp maybe_add_report(result, state, opts) do
    if Keyword.get(opts, :surface) == :report do
      report =
        DefaultViewerState.report()
        |> Map.put(:reported_count, reported_count(state))

      Map.merge(result, report)
    else
      result
    end
  end

  defp emotions(state, projection_type) do
    values = value(state, :emotions, %{})

    projection_type
    |> DefaultViewerState.emotions()
    |> Enum.map(fn default ->
      emotion = default.emotion

      Map.merge(default, %{
        count: value(values, :"#{emotion}_count", 0),
        latest_users: value(values, :"latest_#{emotion}_users", []),
        viewer_has_reacted: value(values, :"viewer_has_#{emotion}ed", false)
      })
    end)
  end

  defp reported_count(state) do
    value(state, :reported_count, value(value(state, :meta, %{}), :reported_count, 0))
  end

  defp fixed_counts_for(info, target_ids) do
    target_ids = Enum.uniq(target_ids)

    if target_ids == [] do
      %{}
    else
      query =
        from(info_row in info.reaction_info_model,
          where: field(info_row, ^info.foreign_key) in ^target_ids,
          select: %{
            target_id: field(info_row, ^info.foreign_key),
            upvotes_count: info_row.upvotes_count,
            interaction_revision: info_row.interaction_revision
          }
        )

      query =
        if Map.get(info, :collection?, false) do
          select_merge(query, [info_row], %{collects_count: info_row.collects_count})
        else
          query
        end

      query
      |> Repo.all()
      |> Map.new(fn row -> {row.target_id, row} end)
    end
  end

  defp fixed_stats_by_target(info, target_ids, user, opts) do
    target_id_field = info.foreign_key
    user_id = if match?(%User{}, user), do: user.id

    query =
      from(info_row in info.reaction_info_model,
        where: field(info_row, ^target_id_field) in ^target_ids,
        select: %{
          target_id: field(info_row, ^target_id_field),
          latest_upvoted_users: info_row.latest_upvoted_users,
          upvotes_count: info_row.upvotes_count,
          interaction_revision: info_row.interaction_revision
        }
      )

    query =
      if Keyword.get(opts, :surface) == :report do
        select_merge(query, [info_row], %{
          reported_count: RoaringBitmap.cardinality(info_row.reported_user_ids)
        })
      else
        query
      end

    query
    |> select_fixed_viewer_state(user_id)
    |> maybe_select_collection_stats(info, user_id)
    |> Repo.all()
    |> Map.new(fn fixed -> {fixed.target_id, Map.merge(empty_state(info), fixed)} end)
  end

  defp emotion_stats_by_target(
         %{emotion_info_model: schema, foreign_key: target_id_field},
         target_ids,
         user,
         emotion_type
       ) do
    user_id = if match?(%User{}, user), do: user.id

    from(info in schema,
      where: field(info, ^target_id_field) in ^target_ids,
      select: %{
        target_id: field(info, ^target_id_field),
        emotion: info.emotion,
        latest_users: info.latest_users,
        count: info.users_count
      }
    )
    |> select_emotion_viewer_state(user_id)
    |> Repo.all()
    |> Enum.group_by(& &1.target_id)
    |> Map.new(fn {target_id, rows} ->
      emotions = Enum.reduce(rows, %{}, &Map.merge(&2, emotion_embed(&1, emotion_type)))
      {target_id, emotions}
    end)
  end

  defp emotion_embed(row, emotion_type) do
    case Reactions.Emotion.decode(row.emotion, emotion_type) do
      {:ok, emotion} ->
        %{
          :"#{emotion}_count" => row.count,
          :"latest_#{emotion}_users" => row.latest_users,
          :"viewer_has_#{emotion}ed" => Map.get(row, :viewer_has_reacted, false)
        }

      {:error, ErrorCat.error_pattern(reason: :unknown_emotion)} ->
        :telemetry.execute([:groupher, :cms, :interactions, :unknown_emotion], %{count: 1}, %{
          emotion: row.emotion,
          type: emotion_type
        })

        %{}
    end
  end

  defp empty_state(%{collection?: true}) do
    DefaultViewerState.article()
    |> Map.delete(:emotions)
  end

  defp empty_state(_info) do
    DefaultViewerState.comment()
    |> Map.delete(:emotions)
  end

  defp select_fixed_viewer_state(query, nil) do
    select_merge(query, %{
      viewer_has_reported: false,
      viewer_has_upvoted: false
    })
  end

  defp select_fixed_viewer_state(query, user_id) do
    select_merge(query, [info], %{
      viewer_has_reported: RoaringBitmap.contains(info.reported_user_ids, ^user_id),
      viewer_has_upvoted: RoaringBitmap.contains(info.upvoted_user_ids, ^user_id)
    })
  end

  defp select_emotion_viewer_state(query, nil) do
    select_merge(query, %{viewer_has_reacted: false})
  end

  defp select_emotion_viewer_state(query, user_id) do
    select_merge(query, [info], %{
      viewer_has_reacted: RoaringBitmap.contains(info.user_ids, ^user_id)
    })
  end

  defp maybe_select_collection_stats(query, %{collection?: true}, nil) do
    select_merge(query, [info], %{
      collects_count: info.collects_count,
      latest_collected_users: info.latest_collected_users,
      viewer_has_collected: false
    })
  end

  defp maybe_select_collection_stats(query, %{collection?: true}, user_id) do
    select_merge(query, [info], %{
      collects_count: info.collects_count,
      latest_collected_users: info.latest_collected_users,
      viewer_has_collected: RoaringBitmap.contains(info.collected_user_ids, ^user_id)
    })
  end

  defp maybe_select_collection_stats(query, _info, _user_id), do: query

  defp value(data, key, default) when is_map(data), do: Map.get(data, key, default) || default
  defp value(_data, _key, default), do: default
end
