defmodule GroupherServer.CMS.Model.DocsPublishApproval do
  @moduledoc """
  A sealed approval for one exact Docs Queue plan and policy revision.

      Queue plan + contributors -> immutable approval -> Release authorization
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix
  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()

  schema "docs_publish_approvals" do
    field(:community_id, :integer)
    field(:queue_id, Ecto.UUID)
    field(:queue_revision, :integer)
    field(:approval_policy_revision, :integer)
    field(:allow_self_approval, :boolean)
    field(:base_release_id, :integer)
    field(:plan_format_version, :integer)
    field(:tree_plan, :map)
    field(:sealed, :boolean, default: false)
    field(:approved_by_id, :integer)
    field(:approved_at, :utc_datetime)
  end

  @doc "Builds an approval to be assembled and sealed in the same transaction."
  def changeset(approval, attrs) do
    approval
    |> cast(attrs, [
      :community_id,
      :queue_id,
      :queue_revision,
      :approval_policy_revision,
      :allow_self_approval,
      :base_release_id,
      :plan_format_version,
      :tree_plan,
      :sealed,
      :approved_by_id,
      :approved_at
    ])
    |> validate_required([
      :community_id,
      :queue_id,
      :queue_revision,
      :approval_policy_revision,
      :allow_self_approval,
      :plan_format_version,
      :tree_plan,
      :approved_by_id,
      :approved_at
    ])
    |> foreign_key_constraint(:queue_id, name: :docs_publish_approval_queue_owner_fkey)
  end
end
