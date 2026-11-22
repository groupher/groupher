defmodule GroupherServer.CMS.Articles.Effects.Outbox do
  @moduledoc """
  Records Article effect intents inside the caller-owned transaction.

  Payloads contain stable resource identity and versioned business data. They
  never persist a module, function, argument tuple, struct, PID, or callback.

      Article Command / Workflow
        -> Effects.Outbox
        -> CMS.Outbox event
  """

  require Logger

  import Ecto.Query
  alias GroupherServer.{Accounts, Activity, CMS, Jobs, Repo}
  alias CMS.Outbox.DedupeKey

  alias CMS.Model.{
    Article,
    ArticleBinding,
    ArticlePublic,
    ArticleSnapshot,
    Author,
    Community,
    CommunityAdmin,
    DocsRelease
  }

  alias Accounts.Model.User

  @doc "Records the first selected public Snapshot for an admitted Binding."
  def published(binding, community, snapshot, operation_ref) do
    publication("article.published", binding, community, snapshot, operation_ref, nil)
  end

  @doc "Records a newly selected public Snapshot for an admitted Binding."
  def updated(binding, community, snapshot, operation_ref) do
    publication("article.updated", binding, community, snapshot, operation_ref, nil)
  end

  @doc "Records a first Docs publication using its sealed site Release."
  def release_published(binding, community, snapshot, release, operation_ref) do
    release_publication("article.published", binding, community, snapshot, release, operation_ref)
  end

  @doc "Records a later Docs publication using its sealed site Release."
  def release_updated(binding, community, snapshot, release, operation_ref) do
    release_publication("article.updated", binding, community, snapshot, release, operation_ref)
  end

  @doc "Records public projection work for the exact selected Public head."
  def projections_selected(
        %ArticleBinding{article_id: id} = binding,
        %ArticlePublic{article_id: id} = public,
        first_publish?,
        operation_ref
      )
      when is_boolean(first_publish?) and is_binary(operation_ref) do
    send_article(
      "article.projections",
      id,
      operation_ref,
      DedupeKey.encode([
        binding.community_id,
        binding.inner_id,
        operation_ref,
        public.snapshot_id
      ]),
      %{
        first_publish?: first_publish?,
        community_id: binding.community_id,
        inner_id: binding.inner_id,
        published_by_id: public.published_by_id,
        snapshot_id: public.snapshot_id
      }
    )
  end

  def projections_selected(_, _, _, _), do: invalid_arguments()

  @doc "Records one Binding visibility transition with its frozen cache scope."
  def visibility_changed(binding, community, operation_ref) do
    visibility("article.visibility_changed", binding, community, operation_ref, nil)
  end

  @doc "Records one Binding review transition with its frozen cache scope."
  def review_changed(binding, community, operation_ref) do
    visibility("article.review_changed", binding, community, operation_ref, nil)
  end

  @doc "Records a Docs removal under the actual sealed site Release."
  def release_removed(
        binding,
        %Community{id: community_id} = community,
        %DocsRelease{id: release_id, community_id: community_id, sealed: true},
        operation_ref
      )
      when is_integer(release_id) and release_id > 0 do
    visibility("article.visibility_changed", binding, community, operation_ref, release_id)
  end

  def release_removed(_, _, _, _), do: invalid_arguments()

  defp release_publication(
         event,
         binding,
         %Community{id: community_id} = community,
         snapshot,
         %DocsRelease{id: release_id, community_id: community_id, sealed: true},
         operation_ref
       )
       when is_integer(release_id) and release_id > 0 do
    publication(event, binding, community, snapshot, operation_ref, release_id)
  end

  defp release_publication(_, _, _, _, _, _), do: invalid_arguments()

  defp publication(
         event,
         %ArticleBinding{article_id: id, community_id: community_id} = binding,
         %Community{id: community_id} = community,
         %ArticleSnapshot{article_id: id} = snapshot,
         operation_ref,
         release_id
       )
       when is_binary(id) and is_binary(operation_ref) do
    data = Map.merge(scope_data(binding, community), %{snapshot_id: snapshot.id})
    dimensions = [community.id, binding.inner_id, operation_ref, snapshot.id]

    send_article(
      event,
      id,
      operation_ref,
      effect_key(dimensions, release_id),
      with_release(data, release_id)
    )
  end

  defp publication(_, _, _, _, _, _), do: invalid_arguments()

  defp visibility(
         event,
         %ArticleBinding{article_id: id, community_id: community_id} = binding,
         %Community{id: community_id} = community,
         operation_ref,
         release_id
       )
       when is_binary(id) and is_binary(operation_ref) do
    dimensions = [community.id, binding.inner_id, operation_ref]

    send_article(
      event,
      id,
      operation_ref,
      effect_key(dimensions, release_id),
      with_release(scope_data(binding, community), release_id)
    )
  end

  defp visibility(_, _, _, _, _), do: invalid_arguments()

  defp scope_data(binding, community) do
    %{
      community: community.slug,
      community_id: community.id,
      thread: binding.thread,
      inner_id: binding.inner_id,
      article_id: binding.article_id
    }
  end

  defp with_release(data, nil), do: data
  defp with_release(data, release_id), do: Map.put(data, :release_id, release_id)
  defp effect_key(dimensions, nil), do: DedupeKey.encode(dimensions)
  defp effect_key(dimensions, release_id), do: DedupeKey.encode(dimensions ++ [release_id])

  defp send_article(event, article_id, operation_ref, dedupe_key, data) do
    CMS.Outbox.send(%{
      event: event,
      worker: Jobs.CMSOutboxArticle,
      resource_type: "article",
      resource_id: article_id,
      operation_ref: operation_ref,
      dedupe_key: dedupe_key,
      data: data
    })
  end

  defp invalid_arguments, do: {:error, :invalid_article_effect_arguments}

  @doc "Freezes first-publish notification recipients and payload in the publish transaction."
  def enqueue_first_publish_notification(
        %Article{id: article_id} = article,
        %Community{} = community,
        %ArticleSnapshot{article_id: article_id} = snapshot,
        actor_id,
        operation_ref
      )
      when is_binary(operation_ref) and is_integer(actor_id) do
    recipients =
      Repo.all(
        from(admin in CommunityAdmin,
          where: admin.community_id == ^community.id,
          select: admin.user_id,
          order_by: admin.user_id
        )
      )
      |> Enum.uniq()

    case Repo.one(
           from(author in Author,
             join: user in User,
             on: user.id == author.user_id,
             where: author.id == ^article.author_id,
             select: user
           )
         ) do
      %User{} = author ->
        CMS.Outbox.send(%{
          event: "article.first_published_notification",
          worker: Jobs.CMSOutboxArticle,
          resource_type: "article",
          resource_id: article.id,
          operation_ref: operation_ref,
          dedupe_key: DedupeKey.encode([article.id, community.id]),
          data: %{
            article_id: article.id,
            community_id: community.id,
            community_slug: community.slug,
            thread: article.thread,
            title: snapshot.title || "",
            digest: Map.get(snapshot, :digest) || snapshot.title || "",
            author_id: article.author_id,
            author: author |> CMS.Model.Embeds.User.from_account_user() |> Map.from_struct(),
            published_by_id: actor_id,
            notify_user_ids: recipients
          }
        })

      nil ->
        {:error, :first_publish_author_not_found}
    end
  end

  def enqueue_first_publish_notification(_, _, _, _, _), do: invalid_arguments()

  @doc "Atomically fans out external effects with replay-stable child identities."
  def dispatch(event) do
    Repo.transact_result(fn ->
      operation_ref = event.operation_ref

      with {:ok, press} <-
             register_child(event.id, %{
               event: "press.cache_invalidation",
               worker: Jobs.CMSOutboxPress,
               resource_type: "community",
               resource_id: event.data["community_id"],
               operation_ref: operation_ref,
               dedupe_key: DedupeKey.encode([event.id]),
               data: %{}
             }),
           {:ok, search} <- child(event, "article.search_sync", Jobs.CMSOutboxSearch),
           {:ok, cdn} <- child(event, "article.cdn_purge", Jobs.CMSOutboxCDN) do
        children = %{press: press, search: search, cdn: cdn}

        {:ok,
         %{
           registered: Map.new(children, fn {kind, child} -> {kind, child.id} end),
           failed_child_ids:
             children |> Map.values() |> Enum.filter(&(&1.status == :failed)) |> Enum.map(& &1.id)
         }}
      end
    end)
  end

  defp child(event, kind, worker) do
    register_child(event.id, %{
      event: kind,
      worker: worker,
      resource_type: event.resource_type,
      resource_id: event.resource_id,
      operation_ref: event.operation_ref,
      dedupe_key: DedupeKey.encode([event.id]),
      data: child_data(event)
    })
  end

  defp child_data(%{event: kind, data: data})
       when kind in ["article.visibility_changed", "article.review_changed"] do
    data
    |> Map.put("source_event", kind)
    |> Map.put("snapshot_id", nil)
  end

  defp child_data(event), do: Map.put(event.data, "source_event", event.event)

  defp register_child(parent_id, attrs) do
    case CMS.Outbox.send(attrs) do
      {:error, {:outbox_effect_dead, child_id}} ->
        # send/1 has already checked this exact version and business projection.
        # Registration is complete; only the child's recovery owner may reset it.
        Logger.warning("CMS Article fanout retained a dead child",
          parent_event_id: parent_id,
          child_event_id: child_id,
          child_event: attrs.event
        )

        {:ok, Repo.get!(CMS.Outbox.Event, child_id)}

      result ->
        result
    end
  end

  @doc "Records one Article activity in the caller-owned transaction."
  def activity(resource, event, opts), do: Activity.log(resource, event, opts)

  @doc "Projects immutable business fields for duplicate Outbox comparison."
  def payload_projection(event, data) do
    case event do
      "article.cdn_purge" ->
        project_with_release(data, [
          "source_event",
          "community",
          "community_id",
          "thread",
          "inner_id",
          "snapshot_id"
        ])

      "article.first_published_notification" ->
        CMS.Outbox.Event.project_fields(data, [
          "article_id",
          "community_id",
          "community_slug",
          "thread",
          "title",
          "digest",
          "author_id",
          "author",
          "published_by_id",
          "notify_user_ids"
        ])

      "article.projections" ->
        CMS.Outbox.Event.project_fields(data, [
          "first_publish?",
          "community_id",
          "inner_id",
          "published_by_id",
          "snapshot_id"
        ])

      "article.published" ->
        project_with_release(data, [
          "community",
          "community_id",
          "thread",
          "inner_id",
          "article_id",
          "snapshot_id"
        ])

      "article.review_changed" ->
        CMS.Outbox.Event.project_fields(data, ["community", "community_id", "thread", "inner_id"])

      "article.search_sync" ->
        project_with_release(data, ["source_event", "community_id", "snapshot_id"])

      "article.updated" ->
        project_with_release(data, [
          "community",
          "community_id",
          "thread",
          "inner_id",
          "article_id",
          "snapshot_id"
        ])

      "article.visibility_changed" ->
        project_with_release(data, ["community", "community_id", "thread", "inner_id"])

      _ ->
        {:error, {:outbox_event_owner_missing, event}}
    end
  end

  defp project_with_release(data, fields) do
    case CMS.Outbox.Event.project_fields(data, fields) do
      {:ok, projected} -> {:ok, Map.put(projected, "release_id", Map.get(data, "release_id"))}
      {:error, _reason} = error -> error
    end
  end
end
