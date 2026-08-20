defmodule GroupherServer.CMS.Interactions.ReadState.Sync do
  @moduledoc """
  Synchronizes derived Interaction state after an authoritative fact changes.

  Reaction callers invoke these functions inside their existing transaction.
  View projection invokes `merge_viewed_users/3` from its durable event flow.

      Reactions / ViewEvents.Project -> Sync -> reaction and emotion info rows
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.FrontDesk
  alias CMS.Interactions.{Config, ErrorCat}
  alias CMS.Model.{Comment, Embeds}
  alias CMS.Model.Interaction.RoaringBitmap

  require RoaringBitmap

  @article_threads Config.article_threads()

  @doc """
  Applies an already-created upvote fact.

  ## Examples

      ReadState.Sync.add_upvote(article, actor)

  """
  @spec add_upvote(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  def add_upvote(%Comment{} = comment, actor),
    do: sync_comment_fixed(comment, :upvote, actor, :add)

  def add_upvote(article, actor), do: sync_article_fixed(article, :upvote, actor, :add)

  @doc """
  Removes an already-deleted upvote fact.

  ## Examples

      ReadState.Sync.remove_upvote(article, actor)

  """
  @spec remove_upvote(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  def remove_upvote(%Comment{} = comment, actor),
    do: sync_comment_fixed(comment, :upvote, actor, :remove)

  def remove_upvote(article, actor), do: sync_article_fixed(article, :upvote, actor, :remove)

  @doc """
  Applies an already-created Article collect fact.

  ## Examples

      ReadState.Sync.add_collect(article, actor)

  """
  @spec add_collect(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  def add_collect(article, actor), do: sync_article_fixed(article, :collect, actor, :add)

  @doc """
  Removes an already-deleted Article collect fact.

  ## Examples

      ReadState.Sync.remove_collect(article, actor)

  """
  @spec remove_collect(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  def remove_collect(article, actor), do: sync_article_fixed(article, :collect, actor, :remove)

  @doc """
  Applies an already-created emotion fact.

  ## Examples

      ReadState.Sync.add_emotion(article, :heart, actor)

  """
  @spec add_emotion(struct(), atom(), User.t()) :: {:ok, map()} | {:error, term()}
  def add_emotion(%Comment{} = comment, emotion, actor),
    do: sync_comment_emotion(comment, emotion, actor, :add)

  def add_emotion(article, emotion, actor),
    do: sync_article_emotion(article, emotion, actor, :add)

  @doc """
  Removes an already-deleted emotion fact.

  ## Examples

      ReadState.Sync.remove_emotion(article, :heart, actor)

  """
  @spec remove_emotion(struct(), atom(), User.t()) :: {:ok, map()} | {:error, term()}
  def remove_emotion(%Comment{} = comment, emotion, actor),
    do: sync_comment_emotion(comment, emotion, actor, :remove)

  def remove_emotion(article, emotion, actor),
    do: sync_article_emotion(article, emotion, actor, :remove)

  @doc """
  Applies an already-created report fact.

  ## Examples

      ReadState.Sync.add_report(article, actor)

  """
  @spec add_report(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  def add_report(%Comment{} = comment, actor),
    do: sync_comment_fixed(comment, :report, actor, :add)

  def add_report(article, actor), do: sync_article_fixed(article, :report, actor, :add)

  @doc """
  Removes an already-deleted report fact.

  ## Examples

      ReadState.Sync.remove_report(article, actor)

  """
  @spec remove_report(struct(), User.t()) :: {:ok, map()} | {:error, term()}
  def remove_report(%Comment{} = comment, actor),
    do: sync_comment_fixed(comment, :report, actor, :remove)

  def remove_report(article, actor), do: sync_article_fixed(article, :report, actor, :remove)

  @doc """
  Merges asynchronously projected viewer ids for one Article.

  ## Examples

      ReadState.Sync.merge_viewed_users(:post, article.id, [viewer.id])

  """
  @spec merge_viewed_users(:post | :blog | :changelog | :doc, integer(), [integer()]) :: :ok
  def merge_viewed_users(thread, target_id, user_ids)
      when thread in @article_threads and is_list(user_ids) do
    info = interaction_info(thread)
    reaction_info = lock_reaction_info(info, target_id)

    from(info in info.reaction_info_model, where: info.id == ^reaction_info.id)
    |> update(
      [info],
      set: [
        viewed_user_ids: RoaringBitmap.merge(info.viewed_user_ids, ^user_ids),
        updated_at: ^DateTime.utc_now(:second)
      ]
    )
    |> Repo.update_all([])

    :ok
  end

  defp sync_article_fixed(article, reaction, %User{} = user, operation)
       when reaction in [:collect, :report, :upvote] and operation in [:add, :remove] do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      sync_fixed(interaction_info(thread), article.id, reaction, user, operation)
    end
  end

  defp sync_comment_fixed(comment, reaction, %User{} = user, operation)
       when reaction in [:report, :upvote] and operation in [:add, :remove] do
    sync_fixed(interaction_info(:comment), comment.id, reaction, user, operation)
  end

  defp sync_article_emotion(article, emotion, %User{} = user, operation)
       when is_atom(emotion) and operation in [:add, :remove] do
    with {:ok, thread} <- FrontDesk.thread_of(article) do
      sync_emotion(interaction_info(thread), article.id, emotion, user, operation)
    end
  end

  defp sync_comment_emotion(comment, emotion, %User{} = user, operation)
       when is_atom(emotion) and operation in [:add, :remove] do
    sync_emotion(interaction_info(:comment), comment.id, emotion, user, operation)
  end

  defp sync_fixed(info, target_id, reaction, user, operation) do
    bitmap_field = bitmap_field(reaction)
    latest_field = latest_field(reaction)
    count_field = count_field(reaction)
    reaction_info = lock_reaction_info(info, target_id)

    latest_users =
      case latest_field do
        nil -> nil
        field -> next_latest_users(Map.get(reaction_info, field, []), user, operation)
      end

    with :ok <-
           update_projection!(
             info.reaction_info_model,
             reaction_info.id,
             bitmap_field,
             user.id,
             operation,
             count_field,
             latest_field,
             latest_users
           ) do
      {:ok, reaction_info}
    end
  end

  defp sync_emotion(info, target_id, emotion, user, operation) do
    emotion_info = lock_emotion_info(info, target_id, emotion)
    latest_users = next_latest_users(emotion_info.latest_users, user, operation)

    with :ok <-
           update_projection!(
             info.emotion_info_model,
             emotion_info.id,
             :user_ids,
             user.id,
             operation,
             :users_count,
             :latest_users,
             latest_users
           ) do
      {:ok, emotion_info}
    end
  end

  defp lock_reaction_info(
         %{reaction_info_model: schema, foreign_key: target_id_field} = reaction_info,
         target_id
       ) do
    insert_info(schema, target_id_field, target_id)

    query =
      from(info in schema,
        where: field(info, ^target_id_field) == ^target_id,
        lock: "FOR UPDATE",
        select: %{id: info.id, latest_upvoted_users: info.latest_upvoted_users}
      )

    if Map.get(reaction_info, :collection?, false) do
      select_merge(query, [info], %{latest_collected_users: info.latest_collected_users})
    else
      query
    end
    |> Repo.one!()
  end

  defp lock_emotion_info(
         %{emotion_info_model: schema, foreign_key: target_id_field},
         target_id,
         emotion
       ) do
    insert_emotion_info(schema, target_id_field, target_id, emotion)

    from(info in schema,
      where: field(info, ^target_id_field) == ^target_id and info.emotion == ^to_string(emotion),
      lock: "FOR UPDATE",
      select: %{id: info.id, latest_users: info.latest_users}
    )
    |> Repo.one!()
  end

  defp insert_info(schema, target_id_field, target_id) do
    now = DateTime.utc_now(:second)

    Repo.insert_all(
      schema,
      [%{target_id_field => target_id, inserted_at: now, updated_at: now}],
      on_conflict: :nothing,
      conflict_target: [target_id_field]
    )
  end

  defp insert_emotion_info(schema, target_id_field, target_id, emotion) do
    now = DateTime.utc_now(:second)

    Repo.insert_all(
      schema,
      [
        %{
          target_id_field => target_id,
          emotion: to_string(emotion),
          inserted_at: now,
          updated_at: now
        }
      ],
      on_conflict: :nothing,
      conflict_target: [target_id_field, :emotion]
    )
  end

  defp update_projection!(
         schema,
         info_id,
         bitmap_field,
         user_id,
         operation,
         count_field,
         latest_field,
         latest_users
       ) do
    bitmap =
      case operation do
        :add -> dynamic([info], RoaringBitmap.add(field(info, ^bitmap_field), ^user_id))
        :remove -> dynamic([info], RoaringBitmap.remove(field(info, ^bitmap_field), ^user_id))
      end

    set = [{bitmap_field, bitmap}, {:updated_at, DateTime.utc_now(:second)}]
    set = maybe_put_latest(set, latest_field, latest_users)
    updates = [set: set]

    updates =
      case count_field do
        nil -> updates
        field -> Keyword.put(updates, :inc, [{field, if(operation == :add, do: 1, else: -1)}])
      end

    case from(info in schema, where: info.id == ^info_id) |> Repo.update_all(updates) do
      {1, _} -> :ok
      {0, _} -> {:error, ErrorCat.projection_not_updated()}
    end
  end

  defp next_latest_users(users, %User{} = user, :add) do
    [snapshot(user) | users]
    |> Enum.uniq_by(&snapshot_user_id/1)
    |> Enum.take(Config.latest_users_limit())
  end

  defp next_latest_users(users, %User{id: user_id}, :remove) do
    Enum.reject(users, &(snapshot_user_id(&1) == user_id))
  end

  defp snapshot(%User{} = user) do
    user
    |> Embeds.User.from_account_user()
    |> Map.from_struct()
  end

  defp snapshot_user_id(%{user_id: user_id}), do: user_id
  defp snapshot_user_id(%{"user_id" => user_id}), do: user_id
  defp snapshot_user_id(_snapshot), do: nil

  defp latest_field(:upvote), do: :latest_upvoted_users
  defp latest_field(:collect), do: :latest_collected_users
  defp latest_field(_reaction), do: nil

  defp bitmap_field(:collect), do: :collected_user_ids
  defp bitmap_field(:report), do: :reported_user_ids
  defp bitmap_field(:upvote), do: :upvoted_user_ids

  defp count_field(:upvote), do: :upvotes_count
  defp count_field(:collect), do: :collects_count
  defp count_field(_reaction), do: nil

  defp maybe_put_latest(attrs, nil, _latest_users), do: attrs
  defp maybe_put_latest(attrs, field, latest_users), do: [{field, latest_users} | attrs]

  defp interaction_info(artiment) do
    {:ok, info} = Matcher.match_interaction(artiment)
    info
  end
end
