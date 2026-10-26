defmodule Helper.Scheduler do
  @moduledoc """
  Quantum scheduler entrypoints for periodic compatibility and maintenance work.

  The scheduler invokes domain facades; it does not own article, comment, Trash,
  or audit state. New durable asynchronous work should normally use Oban jobs.

  Business position:

      Domain or web caller
        -> Scheduler
        -> normalized value / infrastructure
  """
  use Quantum, otp_app: :groupher_server

  # import Config
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.CMS

  @threads CMS.artiment_config_threads()

  @doc """
  Compatibility hook reserved for a full Cachex clear.

  The current implementation intentionally performs no operation.
  """
  def clear_all_cache do
    # Cache.clear_all()
  end

  @doc """
  Archives eligible artiments for every configured thread.
  """
  def archive_artiments do
    Enum.map(@threads, &CMS.Articles.Maintenance.archive(&1))
    |> done
  end

  @doc "Permanently deletes Trash actions whose retention window has elapsed."
  def purge_expired_trash do
    CMS.trash_purge_due()
  end

end
