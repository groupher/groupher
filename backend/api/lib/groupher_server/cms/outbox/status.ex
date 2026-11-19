defmodule GroupherServer.CMS.Outbox.Status do
  @moduledoc """
  Maps the application lifecycle onto the canonical stored Outbox vocabulary.

  The schema uses pending/executing/failed/completed/dead. Application callers
  use waiting/running/retrying/done/failed; unknown stored values are rejected.

      application lifecycle atom -> Outbox.Status -> stored lifecycle string
  """

  @behaviour Ecto.Type

  @statuses [:waiting, :running, :retrying, :done, :failed]
  @dumped %{
    waiting: "pending",
    running: "executing",
    retrying: "failed",
    done: "completed",
    failed: "dead"
  }
  @loaded Map.new(@dumped, fn {application, stored} -> {stored, application} end)

  @impl Ecto.Type
  def type, do: :string

  @impl Ecto.Type
  def cast(value) when value in @statuses, do: {:ok, value}

  def cast(value) when is_binary(value) do
    case Map.fetch(@loaded, value) do
      {:ok, status} -> {:ok, status}
      :error -> :error
    end
  end

  def cast(_value), do: :error

  @impl Ecto.Type
  def dump(value) do
    case Map.fetch(@dumped, value) do
      {:ok, stored} -> {:ok, stored}
      :error -> :error
    end
  end

  @impl Ecto.Type
  def load(value) when is_binary(value) do
    case Map.fetch(@loaded, value) do
      {:ok, status} -> {:ok, status}
      :error -> :error
    end
  end

  def load(_value), do: :error

  @impl Ecto.Type
  def equal?(left, right), do: left == right

  @impl Ecto.Type
  def embed_as(_format), do: :self
end
