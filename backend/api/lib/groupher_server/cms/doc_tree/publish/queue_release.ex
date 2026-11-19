defmodule GroupherServer.CMS.DocTree.Publish.QueueRelease do
  @moduledoc """
  Executes the Queue, ArticlePublic, directory and Release core in one transaction.

      admitted Release -> deterministic plan -> select snapshots -> tree -> Release -> consume Queue

  This core registers the selected Snapshot for Review and publication Activity in the same transaction.
  The caller owns Gate for the site, notifications, other effects,
  Receipt and rollback on every error. This core is not a complete command.
  """

  import Ecto.Query
  alias GroupherServer.{Accounts, AlertWall, CMS, Repo, ReviewBot}
  alias Accounts.Model.User
  alias CMS.Articles.{Numbering, Publishable, WorkingCopy.Snapshotter}
  alias CMS.Artiment.PlateJSON
  alias CMS.ArtimentMentions

  alias CMS.DocTree.Publish.{
    AlignDefault,
    Affected,
    Approval,
    Lifecycle,
    PublicTree,
    Queue,
    Release,
    SelectPublic
  }

  alias CMS.DocTree.Publish.Queue.Dequeue

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    Community,
    DocsPublishApprovalArticle,
    DocsPublishQueue,
    DocsQueueArticle,
    DocsQueueTreeChange
  }

  @doc "Runs the publishing core after the enclosing command has authorized all affected resources."
  def run(
        %Community{} = community,
        %DocsPublishQueue{} = queue,
        revision,
        %User{id: actor_id} = actor,
        command_id,
        operation_ref
      )
      when is_integer(revision) and revision >= 0 and is_integer(actor_id) and actor_id > 0 and
             is_binary(operation_ref) do
    with {:ok, command_id} <- Ecto.UUID.cast(command_id),
         {:ok, operation_ref} <- Ecto.UUID.cast(operation_ref),
         {:ok, queue} <- Queue.advance(community, queue, %{queue_revision: revision}, []),
         %User{} <- Repo.get(User, actor_id),
         ids <-
           Repo.all(
             from(m in DocsQueueArticle,
               where: m.queue_id == ^queue.id,
               order_by: m.article_id,
               select: m.article_id
             )
           ),
         changes <-
           Repo.all(
             from(c in DocsQueueTreeChange,
               where: c.queue_id == ^queue.id,
               order_by: c.node_id,
               lock: "FOR UPDATE"
             )
           ),
         true <- ids != [] or changes != [],
         {:ok, affected} <- Affected.lock(community, ids, changes),
         deleted = affected.deleted,
         {:ok, locked} <- lock_content(community, queue, ids),
         {:ok, lifecycles} <-
           Lifecycle.lock(community, affected.article_ids -- deleted, deleted),
         {:ok, :pass} <- authorize_docs(community, affected.article_ids, actor),
         {:ok, plan} <- Approval.build_plan(community, queue, locked.rows, changes),
         {:ok, snapshots, approval_id} <-
           select_snapshots(queue, locked.rows, actor, command_id),
         approval_members <-
           Map.new(snapshots, fn {article_id, snapshot_id} ->
             {article_id, %{snapshot_id: snapshot_id}}
           end),
         {:ok, :pass} <- Release.validate_approval(queue, plan, approval_members, approval_id),
         now = DateTime.utc_now(:second),
         {:ok, published} <-
           select_publications(
             community,
             queue,
             revision,
             locked.rows,
             snapshots,
             actor,
             lifecycles,
             now,
             operation_ref
           ),
         {:ok, :pass} <-
           remove_publications(community, deleted, lifecycles, now, operation_ref, actor),
         {:ok, _} <- PublicTree.apply(community, queue, revision, plan),
         {:ok, :pass} <- update_publication_counts(community, affected.article_ids),
         {:ok, recorded} <-
           Release.record(
             community,
             queue,
             revision,
             plan,
             published,
             deleted,
             approval_id,
             actor,
             now
           ),
         {:ok, :pass} <-
           enqueue_release_events(community, published, deleted, recorded.release, operation_ref),
         {:ok, :pass} <- enqueue_tree_change(community, changes, operation_ref),
         {:ok, consumed} <-
           Queue.consume_release(
             community,
             queue,
             revision,
             recorded.release.id,
             published,
             operation_ref
           ) do
      {:ok,
       %{
         release: recorded.release,
         queue: consumed.queue,
         plan: plan,
         affected_article_ids: affected.article_ids,
         publications: published,
         deleted_article_ids: deleted
       }}
    else
      :error -> {:error, :invalid_docs_publish}
      nil -> {:error, :invalid_queue_actor}
      false -> {:error, :empty_docs_queue}
      {:error, _reason} = error -> error
    end
  end

  def run(_, _, _, _, _, _), do: {:error, :invalid_docs_publish}

  defp lock_content(_community, _queue, []), do: {:ok, %{rows: []}}
  defp lock_content(community, queue, ids), do: Dequeue.load_locked(community, queue, ids)

  defp authorize_docs(community, ids, actor) do
    Repo.all(from(a in Article, where: a.id in ^ids, order_by: a.id))
    |> Enum.reduce_while({:ok, :pass}, fn article, _ ->
      case CMS.Gate.Access.Check.with_authorized_article_binding(
             actor,
             :publish,
             {community, article},
             fn _canonical -> {:ok, :pass} end
           ) do
        {:ok, :pass} -> {:cont, {:ok, :pass}}
        {:error, _reason} = error -> {:halt, error}
      end
    end)
  end

  defp select_snapshots(%DocsPublishQueue{approval_required: false}, rows, actor, command_id) do
    Enum.reduce_while(rows, {:ok, %{}}, fn row, {:ok, snapshots} ->
      with {:ok, :pass} <- Publishable.validate(row.copy),
           {:ok, snapshot} <- Snapshotter.freeze_locked(row.article, row.copy, actor, command_id) do
        {:cont, {:ok, Map.put(snapshots, row.article.id, snapshot.id)}}
      else
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, snapshots} -> {:ok, snapshots, nil}
      error -> error
    end
  end

  defp select_snapshots(
         %DocsPublishQueue{approval_required: true, latest_approval_id: id},
         rows,
         _actor,
         _command_id
       )
       when is_binary(id) do
    snapshots =
      Repo.all(
        from(a in DocsPublishApprovalArticle,
          where: a.approval_id == ^id,
          order_by: a.article_id,
          lock: "FOR SHARE"
        )
      )
      |> Map.new(&{&1.article_id, &1.snapshot_id})

    if Map.keys(snapshots) |> Enum.sort() == Enum.map(rows, & &1.article.id) do
      {:ok, snapshots, id}
    else
      {:error, :docs_approval_required}
    end
  end

  defp select_snapshots(_, _, _, _), do: {:error, :docs_approval_required}

  defp select_publications(
         community,
         queue,
         revision,
         rows,
         snapshots,
         actor,
         lifecycles,
         now,
         operation_ref
       ) do
    Enum.reduce_while(Enum.with_index(rows), {:ok, []}, fn {row, index}, {:ok, result} ->
      current = Repo.get(ArticlePublic, row.article.id)
      expected = if current, do: current.snapshot_id, else: nil

      binding =
        Repo.get_by!(ArticleBinding, article_id: row.article.id, community_id: community.id)

      with first_publish? <- is_nil(lifecycles[row.article.id].first_published_at),
           {:ok, binding} <- Numbering.assign_binding_inner_id(binding),
           {:ok, selected} <-
             SelectPublic.select(
               community,
               queue,
               revision,
               row.article.id,
               row.copy.revision,
               snapshots[row.article.id],
               expected,
               actor,
               now
             ),
           {:ok, _} <-
             AlignDefault.align(
               community,
               queue,
               revision,
               row.article.id,
               row.copy.revision,
               selected.snapshot.id,
               actor
             ),
           {:ok, :pass} <- initialize_stats(row.article, first_publish?),
           {:ok, published_lifecycle} <-
             Lifecycle.published(lifecycles[row.article.id], first_publish?, now),
           {:ok, _} <- update_article_state(row.article, current, selected.snapshot, now),
           {:ok, _} <-
             capture_mentions(row.article, community, selected.snapshot, now, operation_ref),
           {:ok, _} <-
             register_review(
               row.article,
               selected.snapshot,
               published_lifecycle,
               is_nil(lifecycles[row.article.id].first_published_at),
               operation_ref
             ),
           {:ok, _} <-
             GroupherServer.Activity.log(
               %{
                 article_id: row.article.id,
                 thread: :doc,
                 community_id: community.id,
                 inner_id: binding.inner_id,
                 title: selected.snapshot.title
               },
               :published,
               actor: actor,
               operation_ref: operation_ref,
               operation_index: index,
               metadata: %{snapshot_id: selected.snapshot.id}
             ),
           {:ok, _} <-
             {:ok, :pass} do
        publication = %{
          article_id: row.article.id,
          snapshot_id: selected.snapshot.id,
          work_revision: row.copy.revision,
          first_publish?: first_publish?
        }

        {:cont, {:ok, [publication | result]}}
      else
        {:error, _reason} = error -> {:halt, error}
      end
    end)
    |> case do
      {:ok, items} -> {:ok, Enum.reverse(items)}
      error -> error
    end
  end

  defp update_publication_counts(community, article_ids) do
    users =
      Repo.all(
        from(user in User,
          join: author in CMS.Model.Author,
          on: author.user_id == user.id,
          join: article in Article,
          on: article.author_id == author.id,
          where: article.id in ^article_ids,
          distinct: true,
          order_by: user.id
        )
      )

    with {:ok, _} <- CMS.Communities.update_count_field(community, :doc) do
      Enum.reduce_while(users, {:ok, :pass}, fn user, _ ->
        case Accounts.publish_update_states(user, :doc) do
          {:ok, _} -> {:cont, {:ok, :pass}}
          {:error, _} = error -> {:halt, error}
        end
      end)
    end
  end

  defp initialize_stats(article, true), do: CMS.ArticleStats.initialize(article)
  defp initialize_stats(_article, false), do: {:ok, :pass}

  defp enqueue_publication(
         article,
         community,
         binding,
         snapshot,
         first_publish?,
         operation_ref,
         release_id
       ) do
    CMS.Articles.Effects.enqueue(
      if(first_publish?, do: "article.published", else: "article.updated"),
      "article",
      article.id,
      operation_ref,
      %{
        community: community.slug,
        community_id: community.id,
        thread: :doc,
        inner_id: binding.inner_id,
        article_id: article.id,
        snapshot_id: snapshot.id,
        release_id: release_id
      }
    )
  end

  defp enqueue_tree_change(_community, [], _operation_ref), do: {:ok, :pass}

  defp enqueue_tree_change(community, _changes, operation_ref) do
    CMS.DocTree.Effects.enqueue_invalidation(community, operation_ref)
  end

  defp register_review(article, snapshot, lifecycle, first_publish?, operation_ref) do
    with {:ok, configs} <- ReviewBot.configs(nil, :article) do
      CMS.Review.RequestSubmission.register_in_transaction(
        %{
          type: :article,
          article_id: article.id,
          lifecycle: lifecycle,
          operation_ref: operation_ref
        },
        %{
          title: snapshot.title || "",
          body: CMS.Articles.Body.document(snapshot).plain_text || "",
          images: CMS.Review.Media.article_snapshot_images(snapshot.id)
        },
        configs,
        if(first_publish?, do: :publish, else: :edit)
      )
    end
  end

  defp update_article_state(article, public, snapshot, now) do
    attrs = if is_nil(article.active_at), do: %{active_at: now}, else: %{}

    attrs =
      if public && public.snapshot_id != snapshot.id && not article.is_edited do
        Map.put(attrs, :is_edited, true)
      else
        attrs
      end

    if map_size(attrs) == 0 do
      {:ok, article}
    else
      article |> Article.changeset(attrs) |> Repo.update()
    end
  end

  defp capture_mentions(article, community, snapshot, now, operation_ref) do
    with {:ok, ast} <- PlateJSON.decode(CMS.Articles.Body.document(snapshot).json) do
      ArtimentMentions.update(
        %{type: :doc, article_id: article.id},
        %{
          published_revision_identity: "article-snapshot:#{snapshot.id}",
          ast: ast,
          community_id: community.id,
          mentioned_at: now
        },
        operation_ref
      )
    end
  end

  defp remove_publications(community, ids, lifecycles, now, operation_ref, actor) do
    Enum.reduce_while(ids, {:ok, :pass}, fn id, _ ->
      binding =
        Repo.get_by(ArticleBinding, article_id: id, community_id: community.id, thread: :doc)

      public = Repo.one(from(p in ArticlePublic, where: p.article_id == ^id, lock: "FOR UPDATE"))

      case {binding, public} do
        {%ArticleBinding{}, %ArticlePublic{}} ->
          with {:ok, _} <-
                 CMS.DocTree.DefaultCopy.ensure(community, id, public.snapshot_id, actor),
               {:ok, _} <- Repo.delete(public),
               {:ok, _} <- Lifecycle.deleted(lifecycles[id], now),
               {:ok, _} <- ArtimentMentions.hide_source(%{type: :doc, article_id: id}),
               {:ok, :pass} <-
                 CMS.Review.Requests.mark_content_changed_in_transaction(%{
                   type: :article,
                   article_id: id
                 }),
               {:ok, :pass} <-
                 AlertWall.mark_content_changed_in_transaction(:article, id, operation_ref) do
            {:cont, {:ok, :pass}}
          else
            {:error, _reason} = error -> {:halt, error}
          end

        _ ->
          {:halt, {:error, :docs_public_page_not_published}}
      end
    end)
  end

  defp enqueue_release_events(community, published, deleted_ids, release, operation_ref) do
    with {:ok, :pass} <-
           Enum.reduce_while(published, {:ok, :pass}, fn item, _result ->
             article = Repo.get!(Article, item.article_id)

             binding =
               Repo.get_by!(ArticleBinding,
                 article_id: item.article_id,
                 community_id: community.id
               )

             snapshot = Repo.get!(CMS.Model.ArticleSnapshot, item.snapshot_id)

             with {:ok, _} <-
                    enqueue_publication(
                      article,
                      community,
                      binding,
                      snapshot,
                      item.first_publish?,
                      operation_ref,
                      release.id
                    ),
                  {:ok, _} <-
                    enqueue_first_publish_notification(
                      item.first_publish?,
                      article,
                      community,
                      snapshot,
                      release.published_by_id,
                      operation_ref
                    ) do
               {:cont, {:ok, :pass}}
             else
               {:error, reason} -> {:halt, {:error, reason}}
             end
           end) do
      Enum.reduce_while(deleted_ids, {:ok, :pass}, fn id, _result ->
        binding = Repo.get_by(ArticleBinding, article_id: id, community_id: community.id)

        case binding do
          %ArticleBinding{} ->
            case CMS.Articles.Effects.enqueue(
                   "article.visibility_changed",
                   "article",
                   id,
                   operation_ref,
                   %{
                     community: community.slug,
                     community_id: community.id,
                     thread: :doc,
                     inner_id: binding.inner_id,
                     release_id: release.id
                   }
                 ) do
              {:ok, _} -> {:cont, {:ok, :pass}}
              {:error, reason} -> {:halt, {:error, reason}}
            end

          nil ->
            {:halt, {:error, :docs_public_page_not_published}}
        end
      end)
    end
  end

  defp enqueue_first_publish_notification(
         true,
         article,
         community,
         snapshot,
         actor_id,
         operation_ref
       ) do
    CMS.Articles.Effects.Outbox.enqueue_first_publish_notification(
      article,
      community,
      snapshot,
      actor_id,
      operation_ref
    )
  end

  defp enqueue_first_publish_notification(
         false,
         _article,
         _community,
         _snapshot,
         _actor_id,
         _operation_ref
       ) do
    {:ok, :unchanged}
  end
end
