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
  @failure_sample_size 20

  @doc """
  Processes all candidates due at the supplied UTC time using a stable cursor.

  ## Examples

      GroupherServer.CMS.Communities.Admins.Requests.ExpireDue.run(DateTime.utc_now())
  """
  def run(%DateTime{} = now), do: run_with_executor(now, &Expire.execute/2)
  def run(_), do: {:error, :invalid_request_expiration}

  @doc false
  def run_with_executor(%DateTime{} = now, expire_fun) when is_function(expire_fun, 2) do
    scan(now, nil, 0, 0, [], expire_fun)
  end

  def run_with_executor(_, _), do: {:error, :invalid_request_expiration}

  defp scan(now, cursor, count, failure_count, failure_sample, expire_fun) do
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
        case failure_count do
          0 ->
            {:ok, count}

          _ ->
            {:error,
             {:request_expiration_failures,
              %{count: failure_count, sample: Enum.reverse(failure_sample)}}}
        end

      candidates ->
        {added, batch_failure_count, batch_failure_sample} =
          expire_batch(candidates, now, expire_fun)

        scan(
          now,
          List.last(candidates),
          count + added,
          failure_count + batch_failure_count,
          Enum.take(batch_failure_sample ++ failure_sample, @failure_sample_size),
          expire_fun
        )
    end
  end

  defp expire_batch(candidates, now, expire_fun) do
    Enum.reduce(candidates, {0, 0, []}, fn {_time, id}, {count, failure_count, failures} ->
      case expire_fun.(id, now) do
        {:ok, :unchanged} ->
          {count, failure_count, failures}

        {:ok, %CommunityAdminRequest{}} ->
          {count + 1, failure_count, failures}

        {:error, reason} ->
          Logger.error("failed to expire Community Admin request",
            request_id: id,
            reason: inspect(reason)
          )

          {count, failure_count + 1, [{id, reason} | failures]}
      end
    end)
  end
end
