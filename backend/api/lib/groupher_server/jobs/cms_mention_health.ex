defmodule GroupherServer.Jobs.CMSMentionHealth do
  @moduledoc """
  Reports missing or lagging public Mention watermarks every 15 minutes.

      Oban Cron -> checkpointed read-only report -> telemetry + failed job
  """

  use Oban.Worker, queue: :cms_outbox, max_attempts: 3, unique: [period: 900, states: :incomplete]

  require Logger

  alias GroupherServer.CMS

  @doc """
  Scans every current-source page and fails the scheduled job when issues remain.

  ## Examples

      perform(%Oban.Job{args: %{}})
  """
  @impl Oban.Worker
  def perform(_job) do
    {count, issues} = scan(nil, 0, [])

    failures =
      CMS.artiment_mentions_failed_manifest(CMS.artiment_mentions_failure_manifest_path())
      |> Map.values()

    issue_keys = issues |> Enum.map(& &1.source_key) |> MapSet.new()
    failure_keys = failures |> Enum.map(& &1["source_key"]) |> MapSet.new()
    total = issue_keys |> MapSet.union(failure_keys) |> MapSet.size()

    :telemetry.execute(
      [:groupher_server, :cms, :mention_health],
      %{scanned: count, issues: total},
      %{categories: Enum.frequencies_by(issues, & &1.category)}
    )

    if total > 0 do
      Logger.error("Mention health found #{total} unresolved sources after scanning #{count}")
      {:error, :mention_health_unhealthy}
    else
      {:ok, :pass}
    end
  end

  defp scan(checkpoint, count, issues) do
    result = CMS.artiment_mentions_rebuild_report(checkpoint, 100)
    count = count + result.scanned
    issues = issues ++ result.issues

    if result.more and result.scanned > 0 do
      scan(result.checkpoint, count, issues)
    else
      {count, issues}
    end
  end
end
