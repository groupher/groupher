defmodule GroupherServer.Jobs.SnapshotRefresh do
  @moduledoc """
  Normalizes the versioned snapshot-refresh payload and dispatches it to the
  CMS-owned refresh path for Users, Articles, or Comments.

  Business position:

      CMS write / scheduled refresh
        -> Oban
        -> SnapshotRefresh versioned refs and options
        -> CMS.snapshot_perform_refresh/3
        -> refreshed snapshot cache entries
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:snapshot_refresh),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:snapshot_refresh),
    unique: GroupherServer.Jobs.Config.unique(:snapshot_refresh)

  alias GroupherServer.CMS

  @doc """
  Refreshes one typed snapshot payload through the owning CMS facade.

  ## Examples

      perform(%Oban.Job{args: %{
        "type" => "article",
        "version" => 1,
        "refs" => %{"thread" => "post", "ids" => [Ecto.UUID.generate()]},
        "opts" => %{}
      }})
  """
  @impl Oban.Worker
  def perform(%Oban.Job{
        args: %{"type" => type, "version" => 1, "refs" => refs, "opts" => opts}
      }) do
    resource_type = String.to_existing_atom(type)

    CMS.snapshot_perform_refresh(
      resource_type,
      normalize_refs(resource_type, refs),
      normalize_opts(opts)
    )
  end

  defp normalize_refs(:user, refs), do: refs

  defp normalize_refs(type, %{"thread" => thread, "ids" => ids})
       when type in [:article, :comment] do
    %{thread: String.to_existing_atom(thread), ids: ids}
  end

  defp normalize_opts(opts) when is_map(opts) do
    Enum.map(opts, fn {key, value} -> {String.to_existing_atom(key), value} end)
  end
end
