defmodule GroupherServer.CMS.Communities.Admins.Requests.ExpireDue do
  @moduledoc """
  Scans due Admin requests in bounded batches without holding request row locks.

  The scheduled worker invokes this scan and retries errors through Oban.

      Oban Cron -> ExpireDue -> stable candidate cursor -> locked expiry command
  """
  import Ecto.Query

  alias GroupherServer.CMS.Communities.Admins.Requests.Commands.Expire
  alias GroupherServer.CMS.Model.CommunityAdminRequest
  alias GroupherServer.Repo

  @batch_size 100

  @doc """
  Processes all candidates due at the supplied UTC time using a stable cursor.

  ## Examples

      GroupherServer.CMS.Communities.Admins.Requests.ExpireDue.run(DateTime.utc_now())
  """
  def run(%DateTime{} = now), do: scan(now, nil, 0)
  def run(_), do: {:error, :invalid_request_expiration}

  defp scan(now, cursor, count) do
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
        {:ok, count}

      candidates ->
        with {:ok, added} <- expire_batch(candidates, now) do
          scan(now, List.last(candidates), count + added)
        end
    end
  end

  defp expire_batch(candidates, now) do
    Enum.reduce_while(candidates, {:ok, 0}, fn {_time, id}, {:ok, count} ->
      case Expire.execute(id, now) do
        {:ok, :unchanged} -> {:cont, {:ok, count}}
        {:ok, %CommunityAdminRequest{}} -> {:cont, {:ok, count + 1}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end
end
