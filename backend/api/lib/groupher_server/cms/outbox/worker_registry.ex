defmodule GroupherServer.CMS.Outbox.WorkerRegistry do
  @moduledoc """
  Maps persisted CMS Outbox worker names to the finite set of supported workers.

  Outbox events retain their delivery route so a consistency check can restore
  a missing Oban wakeup without guessing from event payloads or creating atoms
  from database values.

      persisted event.worker -> WorkerRegistry -> allowlisted worker -> Oban wakeup
  """

  @workers [
    GroupherServer.Jobs.CMSArtimentReview,
    GroupherServer.Jobs.CMSMentionNotifier,
    GroupherServer.Jobs.CMSOutboxAdminRequest,
    GroupherServer.Jobs.CMSOutboxArticle,
    GroupherServer.Jobs.CMSOutboxAsset,
    GroupherServer.Jobs.CMSOutboxCDN,
    GroupherServer.Jobs.CMSOutboxComment,
    GroupherServer.Jobs.CMSOutboxCommunity,
    GroupherServer.Jobs.CMSOutboxDocs,
    GroupherServer.Jobs.CMSOutboxInteraction,
    GroupherServer.Jobs.CMSOutboxPress,
    GroupherServer.Jobs.CMSOutboxSearch,
    GroupherServer.Jobs.CMSOutboxTicket
  ]

  @worker_names Map.new(@workers, &{&1, inspect(&1)})
  @workers_by_name Map.new(@workers, &{inspect(&1), &1})

  @doc "Returns the durable Oban worker name for a registered module."
  @spec name_for(module()) :: {:ok, String.t()} | :error
  def name_for(worker) when is_atom(worker), do: Map.fetch(@worker_names, worker)
  def name_for(_worker), do: :error

  @doc "Resolves a persisted worker name without creating atoms."
  @spec worker_for(String.t()) :: {:ok, module()} | :error
  def worker_for(name) when is_binary(name), do: Map.fetch(@workers_by_name, name)
  def worker_for(_name), do: :error
end
