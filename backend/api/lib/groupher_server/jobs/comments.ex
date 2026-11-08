defmodule GroupherServer.Jobs.Comments do
  @moduledoc """
  Executes the finite set of durable background effects emitted by Comments.

      CMS.Comments transaction
        -> GroupherServer.Jobs named facade
        -> Oban row committed with the mutation
        -> this worker after commit
        -> CMS event or projection repair

  The worker intentionally accepts a closed `type` vocabulary. It is not an
  arbitrary module/function/arguments adapter.
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:later),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:later)

  alias GroupherServer.CMS

  @event_types ~w(subscribe_community)

  @doc """
  Performs one persisted Comments job.

  ## Examples

      perform(%Oban.Job{
        args: %{
          "type" => "subscribe_community",
          "version" => 1,
          "payload" => %{"community_id" => community_id, "actor_id" => actor_id}
        }
      })
  """
  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"type" => type, "version" => 1, "payload" => payload}})
      when type in @event_types do
    CMS.comments_deliver_effect(String.to_existing_atom(type), payload)
  end
end
