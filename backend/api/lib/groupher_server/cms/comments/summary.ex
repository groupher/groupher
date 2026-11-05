defmodule GroupherServer.CMS.Comments.Summary do
  @moduledoc """
  Maintains Comment-owned summaries around one canonical fact change.

      caller transaction + stable Article lock
        -> before contribution -> fact mutation -> after contribution
        -> atomic Article/root counters, bounded members and owner revisions

  Nested changes to the same Comment are coalesced at the outer boundary. Reads
  never call this module and it does not initialize or repair missing summaries.
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User

  alias CMS.Model.{
    Article,
    ArticleStats,
    Comment,
    CommentBody,
    CommentLifecycle,
    CommentReviewBlock
  }

  alias CMS.Snapshot.Members

  @active_key {__MODULE__, :active_comments}

  @doc "Applies a fact mutation and its summary delta in the caller's transaction."
  @spec with_change(Comment.t(), (-> {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:error, term()}
  def with_change(%Comment{} = comment, fun) when is_function(fun, 0) do
    active = Process.get(@active_key, MapSet.new())

    cond do
      not Repo.in_transaction?() ->
        {:error, :comment_summary_requires_transaction}

      MapSet.member?(active, comment.id) ->
        fun.()

      true ->
        Process.put(@active_key, MapSet.put(active, comment.id))

        try do
          with %Article{} = article <- lock_article(comment.article_id),
               %ArticleStats{} = stats <- lock_stats(article),
               {:ok, before} <- contribution(comment.id),
               {:ok, value} <- fun.(),
               {:ok, after_change} <- contribution(comment.id),
               {:ok, :pass} <- persist_change(article, stats, before, after_change) do
            {:ok, value}
          else
            nil -> {:error, :comment_summary_owner_missing}
            {:error, _reason} = error -> error
          end
        after
          if MapSet.size(active) == 0 do
            Process.delete(@active_key)
          else
            Process.put(@active_key, active)
          end
        end
    end
  end

  @doc "Tracks Comment Lifecycle/restriction changes and leaves other resource owners alone."
  @spec for_lifecycle(struct(), (-> {:ok, term()} | {:error, term()})) ::
          {:ok, term()} | {:error, term()}
  def for_lifecycle(%CommentLifecycle{comment_id: id}, fun) do
    if Repo.in_transaction?() do
      case Repo.get(Comment, id) do
        %Comment{} = comment -> with_change(comment, fun)
        nil -> {:error, :comment_summary_target_missing}
      end
    else
      fun.()
    end
  end

  def for_lifecycle(_lifecycle, fun), do: fun.()

  defp lock_article(id) do
    Article |> where([a], a.id == ^id) |> lock("FOR UPDATE") |> Repo.one()
  end

  defp lock_stats(article) do
    ArticleStats
    |> where([s], s.article_id == ^article.id and s.thread == ^article.thread)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp contribution(id) do
    blocks = active_blocks()

    query =
      from(c in Comment,
        as: :summary_comment,
        left_join: lifecycle in CommentLifecycle,
        on: lifecycle.comment_id == c.id,
        left_join: body in CommentBody,
        on: body.comment_id == c.id,
        where: c.id == ^id,
        select: %{
          comment: c,
          state: lifecycle.state,
          body_version: body.version,
          blocked: exists(subquery(blocks))
        }
      )

    case Repo.one(query) do
      nil ->
        {:error, :comment_summary_target_missing}

      row ->
        {:ok,
         row
         |> Map.put(:visible?, row.state == :visible and not row.blocked)
         |> Map.put(:entry?, row.state in [:visible, :deleted] and not row.blocked)}
    end
  end

  defp active_blocks do
    from(block in CommentReviewBlock,
      where: block.comment_id == parent_as(:summary_comment).id and is_nil(block.resolved_at),
      select: 1
    )
  end

  defp effective_comments do
    blocks = active_blocks()

    from(c in Comment,
      as: :summary_comment,
      join: lifecycle in CommentLifecycle,
      on: lifecycle.comment_id == c.id,
      where: lifecycle.state == :visible and not exists(subquery(blocks))
    )
  end

  defp persist_change(article, stats, before, current) do
    if public_change?(before, current) do
      comment = current.comment
      delta = contribution_delta(before.visible?, current.visible?)

      other_participation? =
        delta != 0 and
          effective_comments()
          |> where(
            [c],
            c.article_id == ^article.id and c.author_id == ^comment.author_id and
              c.id != ^comment.id
          )
          |> Repo.exists?()

      participant_delta = if other_participation?, do: 0, else: delta

      with {:ok, participants} <-
             next_members(stats.comments_participants, article.id, nil, before, current, 10),
           {:ok, :pass} <-
             update_article(stats, delta, participant_delta, participants),
           {:ok, :pass} <- update_root(article.id, before, current),
           {:ok, :pass} <-
             CMS.Comments.Effects.summary_changed(
               article,
               stats.comments_revision + 1,
               delta != 0
             ) do
        {:ok, :pass}
      end
    else
      {:ok, :pass}
    end
  end

  defp public_change?(before, current) do
    {before.visible?, before.entry?, before.state, before.body_version, before.comment.is_folded,
     before.comment.is_pinned, before.comment.meta} !=
      {current.visible?, current.entry?, current.state, current.body_version,
       current.comment.is_folded, current.comment.is_pinned, current.comment.meta}
  end

  defp update_article(stats, delta, participant_delta, participants) do
    query =
      from(s in ArticleStats,
        where:
          s.id == ^stats.id and
            s.comments_count >= ^max(-delta, 0) and
            s.comments_participants_count >= ^max(-participant_delta, 0),
        update: [
          inc: [
            comments_count: ^delta,
            comments_participants_count: ^participant_delta,
            comments_revision: 1
          ],
          set: [
            comments_participants: ^participants,
            snapshot_at: fragment("date_trunc('second', clock_timestamp())"),
            updated_at: fragment("date_trunc('second', clock_timestamp())")
          ]
        ]
      )

    case Repo.update_all(query, []) do
      {1, _} -> {:ok, :pass}
      _ -> {:error, :comment_summary_not_updated}
    end
  end

  defp update_root(_article_id, _before, %{comment: %{reply_to_comment_id: nil}}) do
    {:ok, :pass}
  end

  defp update_root(article_id, before, current) do
    root_id = current.comment.root_comment_id

    case Comment
         |> where([c], c.id == ^root_id and c.article_id == ^article_id)
         |> lock("FOR UPDATE")
         |> Repo.one() do
      nil ->
        {:error, :comment_summary_root_missing}

      root ->
        with {:ok, participants} <-
               next_members(root.reply_participants, article_id, root_id, before, current, 4) do
          last_reply_at =
            effective_comments()
            |> where([c], c.article_id == ^article_id and c.root_comment_id == ^root_id)
            |> order_by([c], desc: c.inserted_at, desc: c.id)
            |> limit(1)
            |> select([c], c.inserted_at)
            |> Repo.one()

          updates = [
            inc: [
              replies_count: contribution_delta(before.visible?, current.visible?),
              reply_entries_count: contribution_delta(before.entry?, current.entry?),
              replies_revision: 1
            ],
            set: [reply_participants: participants, last_reply_at: last_reply_at]
          ]

          case Comment |> where([c], c.id == ^root.id) |> Repo.update_all(updates) do
            {1, _} -> {:ok, :pass}
            _ -> {:error, :comment_root_summary_not_updated}
          end
        end
    end
  end

  defp next_members(existing, _article_id, _root_id, before, current, _limit)
       when before.visible? == current.visible? do
    {:ok, existing}
  end

  defp next_members(existing, article_id, root_id, before, current, limit) do
    if is_nil(before.state) and current.visible? do
      user =
        User
        |> where([u], u.id == ^current.comment.author_id)
        |> select([u], struct(u, [:id, :login, :nickname, :avatar]))
        |> Repo.one()

      case user do
        %User{} -> Members.promote(existing, user, limit)
        nil -> {:error, :comment_participant_missing}
      end
    else
      latest =
        effective_comments()
        |> where([c], c.article_id == ^article_id)
        |> scope_root(root_id)
        |> distinct([c], c.author_id)
        |> order_by([c], asc: c.author_id, desc: c.inserted_at, desc: c.id)
        |> select([c], %{author_id: c.author_id, inserted_at: c.inserted_at, id: c.id})

      users =
        from(latest in subquery(latest),
          join: user in User,
          on: user.id == latest.author_id,
          order_by: [desc: latest.inserted_at, desc: latest.id],
          limit: ^limit,
          select: struct(user, [:id, :login, :nickname, :avatar])
        )
        |> Repo.all()

      Members.bounded(users, limit)
    end
  end

  defp scope_root(query, nil), do: query
  defp scope_root(query, root_id), do: where(query, [c], c.root_comment_id == ^root_id)
  defp contribution_delta(before, current), do: flag(current) - flag(before)
  defp flag(true), do: 1
  defp flag(false), do: 0
end
