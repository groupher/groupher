defmodule GroupherServer.Messaging.Notices.Dedup do
  @moduledoc """
  Claims stable delivery keys before a retryable effect creates a notice.

      durable effect -> delivery key claim -> grouped notice -> attach row

  The claim and notification write share the caller transaction, so a failed
  delivery rolls both back and a retry cannot create a second notice.
  """

  use Ecto.Schema

  import Ecto.Query

  alias GroupherServer.{Messaging, Repo}
  alias Messaging.Model.Notice

  @schema_prefix "messaging"

  schema "notice_dedup" do
    field(:delivery_key, :string)
    belongs_to(:notice, Notice, foreign_key: :notice_id)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc """
  Claims a delivery key, returning whether this transaction owns delivery.

  ## Examples

      Dedup.claim("admin-request:community_admin:id:1:created:recipient")
  """
  @spec claim(String.t()) :: {:ok, :claimed | :already_delivered}
  def claim(delivery_key) when is_binary(delivery_key) and delivery_key != "" do
    now = DateTime.utc_now(:second)

    case Repo.insert_all(
           __MODULE__,
           [%{delivery_key: delivery_key, inserted_at: now}],
           on_conflict: :nothing,
           conflict_target: [:delivery_key]
         ) do
      {1, _} -> {:ok, :claimed}
      {0, _} -> {:ok, :already_delivered}
    end
  end

  @doc """
  Associates the claimed key with the grouped notice row.

  ## Examples

      Dedup.attach(delivery_key, notice)
  """
  @spec attach(String.t(), Notice.t()) :: {:ok, :pass} | {:error, term()}
  def attach(delivery_key, %Notice{id: notice_id}) do
    case Repo.update_all(
           from(delivery in __MODULE__, where: delivery.delivery_key == ^delivery_key),
           set: [notice_id: notice_id]
         ) do
      {1, _} -> {:ok, :pass}
      _ -> {:error, :notice_dedup_not_claimed}
    end
  end
end
