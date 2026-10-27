defmodule GroupherServer.CMS.Articles.Effects.Outbox do
  @moduledoc """
  Records Article effect intents inside the caller-owned transaction.

  Payloads contain stable resource identity and versioned business data. They
  never persist a module, function, argument tuple, struct, PID, or callback.

      Article Command / Workflow
        -> Effects.Outbox
        -> CMS.Outbox event
  """

  alias GroupherServer.{Activity, CMS, Jobs, Repo}

  @doc "Records one Article effect in the caller-owned transaction."
  def enqueue(event, resource_type, resource_id, identity, data, opts)
      when is_binary(event) and is_binary(resource_type) and is_map(data) and is_list(opts) do
    CMS.Outbox.send(%{
      event: event,
      worker: GroupherServer.Jobs.CMSOutboxArticle,
      resource_type: resource_type,
      resource_id: resource_id,
      identity: identity,
      effect_key: Keyword.get(opts, :effect_key, "default"),
      retry_failed: Keyword.get(opts, :retry_failed, false),
      data: data
    })
  end

  def enqueue(_event, _resource_type, _resource_id, _identity, _data, _opts) do
    {:error, :invalid_article_effect_arguments}
  end

  @doc "Atomically fans out external effects with replay-stable child identities."
  def dispatch(event) do
    Repo.transact_result(fn ->
      identity = {:workflow, event.id}

      with {:ok, press} <-
             CMS.Outbox.send(%{
               event: "press.cache_invalidation",
               worker: Jobs.CMSOutboxPress,
               resource_type: "community",
               resource_id: event.data["community_id"],
               identity: identity,
               data: %{}
             }),
           {:ok, search} <- child(event, "article.search_sync", Jobs.CMSOutboxSearch),
           {:ok, cdn} <- child(event, "article.cdn_purge", Jobs.CMSOutboxCDN) do
        {:ok, %{press: press, search: search, cdn: cdn}}
      end
    end)
  end

  defp child(event, kind, worker) do
    CMS.Outbox.send(%{
      event: kind,
      worker: worker,
      resource_type: event.resource_type,
      resource_id: event.resource_id,
      identity: {:workflow, event.id},
      data: Map.put(event.data, "source_event", event.event)
    })
  end

  @doc "Records one Article activity in the caller-owned transaction."
  def activity(resource, event, opts), do: Activity.log(resource, event, opts)
end
