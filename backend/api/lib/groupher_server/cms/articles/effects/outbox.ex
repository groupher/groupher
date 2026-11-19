defmodule GroupherServer.CMS.Articles.Effects.Outbox do
  @moduledoc """
  Records Article effect intents inside the caller-owned transaction.

  Payloads contain stable resource identity and versioned business data. They
  never persist a module, function, argument tuple, struct, PID, or callback.

      Article Command / Workflow
        -> Effects.Outbox
        -> CMS.Outbox event
  """

  import Ecto.Query
  require Logger
  alias GroupherServer.{Activity, CMS, Jobs, Repo}
  alias CMS.Outbox.DedupeKey
  alias CMS.Model.{Author, Community, CommunityAdmin}
  alias GroupherServer.Accounts.Model.User

  @doc "Records one Article effect in the caller-owned transaction."
  def enqueue(event, resource_type, resource_id, operation_ref, data)
      when is_binary(event) and is_binary(resource_type) and is_map(data) and
             is_binary(operation_ref) do
    CMS.Outbox.send(%{
      event: event,
      worker: GroupherServer.Jobs.CMSOutboxArticle,
      resource_type: resource_type,
      resource_id: resource_id,
      operation_ref: operation_ref,
      dedupe_key: article_effect_key(event, resource_id, operation_ref, data),
      data: data
    })
  end

  def enqueue(_event, _resource_type, _resource_id, _operation_ref, _data) do
    {:error, :invalid_article_effect_arguments}
  end

  @doc "Freezes first-publish notification recipients and payload in the publish transaction."
  def enqueue_first_publish_notification(
        article,
        %Community{} = community,
        snapshot,
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

    author_name =
      Repo.one(
        from(author in Author,
          join: user in User,
          on: user.id == author.user_id,
          where: author.id == ^article.author_id,
          select: user.nickname
        )
      )

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
        author_name: author_name,
        published_by_id: actor_id,
        notify_user_ids: recipients
      }
    })
  end

  defp article_effect_key(event, _resource_id, operation_ref, data)
       when event in ["article.published", "article.updated"] do
    key = [
      Map.get(data, :community_id) || Map.get(data, "community_id"),
      Map.get(data, :inner_id) || Map.get(data, "inner_id"),
      operation_ref,
      Map.get(data, :snapshot_id) || Map.get(data, "snapshot_id")
    ]

    case Map.get(data, :release_id) || Map.get(data, "release_id") do
      nil -> DedupeKey.encode(key)
      release_id -> DedupeKey.encode(key ++ [release_id])
    end
  end

  defp article_effect_key("article.projections", _resource_id, operation_ref, data) do
    DedupeKey.encode([
      Map.get(data, :community_id) || Map.get(data, "community_id"),
      Map.get(data, :inner_id) || Map.get(data, "inner_id"),
      operation_ref,
      Map.get(data, :snapshot_id) || Map.get(data, "snapshot_id")
    ])
  end

  defp article_effect_key("article.visibility_changed", _resource_id, operation_ref, data) do
    key = [
      Map.get(data, :community_id) || Map.get(data, "community_id"),
      Map.get(data, :inner_id) || Map.get(data, "inner_id"),
      operation_ref
    ]

    case Map.get(data, :release_id) || Map.get(data, "release_id") do
      nil -> DedupeKey.encode(key)
      release_id -> DedupeKey.encode(key ++ [release_id])
    end
  end

  defp article_effect_key("article.review_changed", resource_id, operation_ref, _data) do
    DedupeKey.encode([resource_id, operation_ref])
  end

  defp article_effect_key(event, resource_id, _operation_ref, _data) do
    DedupeKey.encode([event, resource_id])
  end

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
      data: Map.put(event.data, "source_event", event.event)
    })
  end

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
end
