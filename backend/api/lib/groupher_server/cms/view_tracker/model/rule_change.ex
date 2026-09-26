defmodule GroupherServer.CMS.ViewTracker.Model.RuleChange do
  @moduledoc """
  Audit record for one deployed view-counting rule change.

      release migration
        -> RuleChange
        -> effective time and changed values
        -> analytics interpretation only
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "view_counting_rule_changes" do
    field(:effective_at, :utc_datetime)
    field(:changed_values, :map, default: %{})
    field(:reason, :string)
    field(:deploy_revision, :string)

    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc false
  def changeset(rule_change, attrs) do
    rule_change
    |> cast(attrs, [:effective_at, :changed_values, :reason, :deploy_revision])
    |> validate_required([:effective_at, :changed_values, :reason, :deploy_revision])
    |> unique_constraint(:deploy_revision,
      name: :view_counting_rule_changes_deploy_revision_index
    )
  end
end
