defmodule GroupherServer.Jobs.SnapshotRefresh do
  @moduledoc """
  Snapshot cache refresh job.

  Business position:

      Domain event / scheduler
        -> Oban
        -> SnapshotRefresh
        -> context / service
  """

  alias GroupherServer.Jobs.Config

  use Oban.Worker,
    queue: Config.queue(:snapshot_refresh),
    max_attempts: Config.max_attempts(:snapshot_refresh),
    unique: Config.unique(:snapshot_refresh)

  alias GroupherServer.CMS
  alias GroupherServer.Jobs.Codec

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"kind" => kind, "refs" => refs, "opts" => opts}}) do
    CMS.Snapshot.perform_refresh(
      String.to_existing_atom(kind),
      Codec.decode(refs),
      Codec.decode(opts)
    )
  end
end
