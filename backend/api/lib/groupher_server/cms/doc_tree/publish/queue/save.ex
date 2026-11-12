defmodule GroupherServer.CMS.DocTree.Publish.Queue.Save do
  @moduledoc """
  Saves the independent Queue WorkingCopy under the site's revision boundary.

      admitted Docs command -> Queue / Doc locks -> WorkingCopy save -> Queue revision

  The caller owns Gate, Lifecycle, Receipt, notifications and transaction
  rollback. This internal operation never permits choosing an arbitrary copy.
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.Store, as: WorkingCopyStore
  alias CMS.DocTree.Publish.{ContentMerge, ContentState, Queue}

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticleSnapshot,
    ArticleWorkingCopy,
    Community,
    DocsPublishQueue,
    DocsQueueArticle
  }

  @doc "Saves one Queue member and advances its Queue input revision atomically."
  def save(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        queue_revision,
        article_id,
        work_revision,
        attrs,
        %User{id: user_id} = actor
      )
      when is_integer(queue_revision) and queue_revision >= 0 and is_binary(article_id) and
             is_integer(work_revision) and work_revision > 0 and is_map(attrs) and
             is_integer(user_id) and user_id > 0 do
    with {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: queue_revision}, []),
         %User{} <- Repo.get(User, user_id),
         {:ok, %{work: work}} <- lock_member(community, queue, article_id, work_revision),
         {:ok, before} <- ContentState.load(work),
         {:ok, saved} <-
           WorkingCopyStore.save_loaded(work, attrs, actor, work_revision, community.id),
         {:ok, after_save} <- ContentState.load(saved),
         {:ok, changed} <- ContentMerge.exclusive_changes(before, after_save, before),
         {:ok, :pass} <-
           maybe_record_contribution(community, queue, queue_revision, article_id, actor, changed),
         {:ok, updated_queue} <-
           Queue.advance(community, queue, %{queue_revision: queue_revision}, [:queue_revision]) do
      {:ok, %{queue: updated_queue, working_copy: saved, changed_fields: changed}}
    else
      :error -> {:error, :invalid_queue_member}
      nil -> {:error, :invalid_queue_actor}
      {:error, _reason} = error -> error
    end
  end

  def save(_, _, _, _, _, _, _), do: {:error, :invalid_queue_member}

  @doc false
  def lock_member(community, queue, article_id, work_revision) do
    article = Repo.one(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE"))

    binding =
      Repo.one(
        from(b in ArticleBinding,
          where: b.article_id == ^article_id and b.community_id == ^community.id,
          lock: "FOR SHARE"
        )
      )

    member =
      Repo.one(
        from(m in DocsQueueArticle,
          where: m.queue_id == ^queue.id and m.article_id == ^article_id,
          lock: "FOR UPDATE"
        )
      )

    with %Article{thread: :doc} <- article,
         %ArticleBinding{thread: :doc} <- binding,
         %DocsQueueArticle{} <- member do
      works =
        Repo.all(
          from(w in ArticleWorkingCopy,
            where:
              w.article_id == ^article_id and
                (w.scope_kind == :default or w.id == ^member.working_copy_id),
            order_by: w.id,
            lock: "FOR UPDATE"
          )
        )

      default = Enum.find(works, &(&1.scope_kind == :default))
      work = Enum.find(works, &(&1.id == member.working_copy_id))

      source =
        Repo.one(
          from(s in ArticleSnapshot, where: s.id == ^member.source_snapshot_id, lock: "FOR SHARE")
        )

      with {:ok, :pass} <-
             validate_locked(article_id, queue.id, default, work, source, work_revision) do
        {:ok, %{article: article, member: member, default: default, work: work, source: source}}
      end
    else
      nil -> {:error, :queue_member_not_found}
      _ -> {:error, :invalid_queue_member_owner}
    end
  end

  defp validate_locked(article_id, queue_id, default, work, source, revision) do
    cond do
      not match?(%ArticleWorkingCopy{scope_kind: :default, scope_id: ^article_id}, default) ->
        {:error, :invalid_queue_member_owner}

      not match?(
        %ArticleWorkingCopy{article_id: ^article_id, scope_kind: :workspace, scope_id: ^queue_id},
        work
      ) ->
        {:error, :invalid_queue_member_owner}

      not match?(
        %ArticleSnapshot{article_id: ^article_id, source_working_copy_id: id}
        when id == default.id,
        source
      ) ->
        {:error, :invalid_queue_member_owner}

      work.revision != revision ->
        {:error, {:queue_work_revision_conflict, article_id, work.revision}}

      true ->
        {:ok, :pass}
    end
  end

  defp maybe_record_contribution(_community, _queue, _revision, _article_id, _actor, []) do
    {:ok, :pass}
  end

  defp maybe_record_contribution(community, queue, revision, article_id, actor, _changed) do
    case Queue.record_contribution(community, queue, revision, article_id, actor) do
      {:ok, _} -> {:ok, :pass}
      {:error, _reason} = error -> error
    end
  end
end
