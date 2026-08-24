defmodule GroupherServer.Jobs.Comments do
  @moduledoc """
  Executes the finite set of durable background effects emitted by Comments.

      CMS.Comments transaction
        -> GroupherServer.Jobs named facade
        -> Oban row committed with the mutation
        -> this worker after commit
        -> CMS event or projection repair

  The worker intentionally accepts a closed `kind` vocabulary. It is not an
  arbitrary module/function/arguments adapter.
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:later),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:later)

  alias GroupherServer.CMS.Events
  alias GroupherServer.Jobs.Codec
  alias Helper.ORM

  @event_kinds ~w(sync_mentions audition notify_comment notify_reply subscribe_community)

  @doc """
  Performs one persisted Comments job.

  ## Examples

      perform(%Oban.Job{args: %{"kind" => "sync_mentions", "payload" => encoded}})
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"kind" => kind, "payload" => encoded}})
      when kind in @event_kinds do
    payload = Codec.decode(encoded)
    Events.emit(String.to_existing_atom(kind), payload)
  end

  def perform(%Oban.Job{
        args: %{"kind" => "reconcile_comments_participants", "payload" => encoded}
      }) do
    %{article: article, total_count: total_count} = Codec.decode(encoded)
    ORM.update(article, %{comments_participants_count: total_count})
  end
end
