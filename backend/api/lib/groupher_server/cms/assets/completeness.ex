defmodule GroupherServer.CMS.Assets.Completeness do
  @moduledoc """
  Owns the conservative asset-usage backfill fence.

  Business position:

      asset read or cleanup decision
        -> Assets.Completeness
        -> pending/completed receipt -> allow or block destructive work
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.AssetUsageCompleteness

  @doc "Returns whether a community has a completed usage receipt."
  def completed?(community_id) do
    match?(
      %AssetUsageCompleteness{status: :completed},
      Repo.get(AssetUsageCompleteness, community_id)
    )
  end

  @doc "Creates a pending receipt for a newly created community scope."
  def ensure_new_scope(community_id) do
    attrs = %{
      community_id: community_id,
      schema_version: 1,
      status: :pending,
      scope: "community",
      receipt_id: nil,
      completed_at: nil
    }

    case Repo.insert(AssetUsageCompleteness.changeset(%AssetUsageCompleteness{}, attrs),
           on_conflict: :nothing,
           conflict_target: [:community_id]
         ) do
      {:ok, _record} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Marks a bounded backfill scope as pending."
  def mark_pending(community_id), do: upsert(community_id, %{status: :pending, completed_at: nil})

  @doc false
  def lock_scope(community_id) do
    with :ok <- ensure_new_scope(community_id),
         %AssetUsageCompleteness{} <-
           Repo.one!(
             from(scope in AssetUsageCompleteness,
               where: scope.community_id == ^community_id,
               lock: "FOR UPDATE"
             )
           ) do
      :ok
    end
  end

  @doc "Writes the receipt after a bounded backfill scan completes."
  def complete(community_id, opts \\ []) do
    upsert(community_id, %{
      status: :completed,
      scope: Keyword.get(opts, :scope, "community"),
      receipt_id: Keyword.get(opts, :receipt_id, Ecto.UUID.generate()),
      completed_at: DateTime.utc_now(:second)
    })
  end

  @doc false
  def guard(community_id) do
    with :ok <- lock_scope(community_id),
         true <- completed?(community_id) do
      :ok
    else
      false -> {:error, CMS.Assets.ErrorCat.custom("asset usage backfill incomplete")}
      {:error, reason} -> {:error, reason}
    end
  end

  defp upsert(community_id, attrs) do
    case Repo.get(AssetUsageCompleteness, community_id) do
      nil ->
        AssetUsageCompleteness.changeset(
          %AssetUsageCompleteness{},
          Map.merge(%{community_id: community_id, schema_version: 1}, attrs)
        )
        |> Repo.insert()

      %AssetUsageCompleteness{} = record ->
        record |> AssetUsageCompleteness.changeset(attrs) |> Repo.update()
    end
  end
end
