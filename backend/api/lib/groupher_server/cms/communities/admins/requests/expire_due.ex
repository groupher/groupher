defmodule GroupherServer.CMS.Communities.Admins.Requests.ExpireDue do
  @moduledoc """
  Scans due Admin requests in bounded batches without holding request row locks.

  The scheduled worker invokes this scan and retries errors through Oban.

      Oban Cron -> ExpireDue -> stable candidate cursor -> locked expiry command
  """
  require Logger
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Communities.Admins.Requests.Commands.Expire
  alias CMS.Model.CommunityAdminRequest

  @batch_size 100

  @doc """
  Processes all candidates due at the supplied UTC time using a stable cursor.

  ## Examples

      GroupherServer.CMS.Communities.Admins.Requests.ExpireDue.run(DateTime.utc_now())
  """
  def run(%DateTime{} = now), do: scan(now, nil, 0, [])
  def run(_), do: {:error, :invalid_request_expiration}

  defp scan(now, cursor, count, failures) do
    query =
      from(r in CommunityAdminRequest,
        where: r.status == :pending and r.expires_at <= ^now,
        order_by: [asc: r.expires_at, asc: r.id],
        limit: ^@batch_size,
        select: {r.expires_at, r.id}
      )

    query =
      case cursor do
        nil ->
          query

        {time, id} ->
          where(query, [r], r.expires_at > ^time or (r.expires_at == ^time and r.id > ^id))
      end

    case Repo.all(query) do
      [] ->
        case failures do
          [] -> {:ok, count}
          _ -> {:error, {:request_expiration_failures, Enum.reverse(failures)}}
        end

      candidates ->
        {added, batch_failures} = expire_batch(candidates, now)
        scan(now, List.last(candidates), count + added, batch_failures ++ failures)
    end
  end

  defp expire_batch(candidates, now) do
    Enum.reduce(candidates, {0, []}, fn {_time, id}, {count, failures} ->
      case Expire.execute(id, now) do
        {:ok, :unchanged} ->
          {count, failures}

        {:ok, %CommunityAdminRequest{}} ->
          {count + 1, failures}

        {:error, reason} ->
          Logger.error("failed to expire Community Admin request",
            request_id: id,
            reason: inspect(reason)
          )

          {count, [{id, reason} | failures]}
      end
    end)
  end
end
