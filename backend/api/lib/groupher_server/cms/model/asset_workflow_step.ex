defmodule GroupherServer.CMS.Model.AssetWorkflowStep do
  @moduledoc """
  Durable step identity, result and lease for an Asset workflow run.

      pending step
        -> claimed with lease
        -> succeeded/skipped result or failed/conflict result
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.AssetWorkflowRun
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @states [:pending, :claimed, :succeeded, :skipped, :failed, :conflict]

  schema "asset_workflow_steps" do
    belongs_to(:run, AssetWorkflowRun)
    field(:step_ref, :string)
    field(:operation_ref, Ecto.UUID, read_after_writes: true)
    field(:resource_type, :string)
    field(:resource_id, :string)
    field(:status, Ecto.Enum, values: @states, default: :pending)
    field(:attempts, :integer, default: 0)
    field(:locked_by, :string)
    field(:lease_expires_at, :utc_datetime)
    field(:payload, :map, default: %{})
    field(:result, :map, default: %{})
    field(:last_error, :string)
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(step, attrs) do
    step
    |> cast(attrs, [
      :run_id,
      :step_ref,
      :resource_type,
      :resource_id,
      :status,
      :attempts,
      :locked_by,
      :lease_expires_at,
      :payload,
      :result,
      :last_error
    ])
    |> validate_required([
      :run_id,
      :step_ref,
      :resource_type,
      :resource_id,
      :status,
      :attempts,
      :payload,
      :result
    ])
    |> validate_inclusion(:status, @states)
    |> validate_number(:attempts, greater_than_or_equal_to: 0)
    |> foreign_key_constraint(:run_id)
    |> unique_constraint([:run_id, :step_ref], name: :asset_workflow_steps_run_step_ref_index)
  end
end
