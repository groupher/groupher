defmodule GroupherServer.CMS.Model.DocsPublishQueue do
  @moduledoc """
  Site-owned version and policy state for the Docs publishing queue.

      Docs command -> site lock -> Queue row -> workspace and publication facts

  The Queue ID is a UUID workspace scope; Community identity remains an integer.
  """

  use Ecto.Schema

  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()

  @type t :: %__MODULE__{}

  schema "docs_publish_queues" do
    field(:community_id, :integer)
    field(:tree_lock_version, :integer, default: 0)
    field(:queue_revision, :integer, default: 0)
    field(:public_presentation_revision, :integer, default: 0)
    field(:approval_policy_revision, :integer, default: 0)
    field(:approval_required, :boolean, default: false)
    field(:allow_self_approval, :boolean, default: false)
    field(:public_release_id, :integer)
    field(:latest_approval_id, Ecto.UUID)
    timestamps(type: :utc_datetime)
  end
end
