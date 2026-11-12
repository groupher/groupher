defmodule GroupherServer.CMS.Model.DocsLifecycle do
  @moduledoc """
  Branch-free Doc lifecycle stored alongside its protected default working copy.

    This schema targets the rebuilt table and is used only by the new Docs path.

      Docs lifecycle operations -> DocsLifecycle schema -> cms.doc_lifecycles
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @states [:draft, :published, :archived, :deleted, :destroy]

  schema "doc_lifecycles" do
    field(:community_id, :integer)
    field(:article_id, Ecto.UUID)
    field(:default_working_copy_id, Ecto.UUID)
    field(:default_working_copy_scope, :string, default: "default")
    field(:state, Ecto.Enum, values: @states, default: :draft)
    field(:version, :integer, default: 1)
    field(:changed_at, :utc_datetime)
    field(:first_published_at, :utc_datetime)
    field(:archived_at, :utc_datetime)
    field(:deleted_at, :utc_datetime)
    field(:destroyed_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a lifecycle record or applies a checked lifecycle transition."
  def changeset(lifecycle, attrs) do
    lifecycle
    |> cast(attrs, [
      :community_id,
      :article_id,
      :default_working_copy_id,
      :state,
      :version,
      :changed_at,
      :first_published_at,
      :archived_at,
      :deleted_at,
      :destroyed_at
    ])
    |> validate_required([
      :community_id,
      :article_id,
      :state,
      :version,
      :changed_at
    ])
    |> validate_number(:version, greater_than: 0)
  end
end
