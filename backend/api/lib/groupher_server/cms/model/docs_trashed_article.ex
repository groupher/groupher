defmodule GroupherServer.CMS.Model.DocsTrashedArticle do
  @moduledoc """
  Site-owned Trash membership retaining a Doc's stable Article and default copy.

      Docs Trash operations -> DocsTrashedArticle schema -> cms.trashed_doc_articles
  """

  use Ecto.Schema
  use Flop.Schema
  import Ecto.Changeset

  alias GroupherServer.{CMS, Accounts}
  alias CMS.Model.{Article, Community, TrashAction}
  alias Accounts.Model.User
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @flop_options [
    filterable: [],
    sortable: [:inserted_at, :id],
    pagination_types: [:page, :first]
  ]

  schema "trashed_doc_articles" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:trash_action, TrashAction)
    belongs_to(:community, Community)
    belongs_to(:article, Article, type: Ecto.UUID)
    field(:restore_state, Ecto.Enum, values: [:draft, :published, :archived])
    belongs_to(:deleted_by, User)
    field(:deleted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc "Validates one Trash member for the owning site."
  def changeset(item, attrs) do
    item
    |> cast(attrs, [
      :trash_action_id,
      :community_id,
      :article_id,
      :restore_state,
      :deleted_by_id,
      :deleted_at
    ])
    |> validate_required([
      :trash_action_id,
      :community_id,
      :article_id,
      :restore_state,
      :deleted_at
    ])
    |> unique_constraint(:hash_id)
    |> unique_constraint(:article_id)
    |> foreign_key_constraint(:trash_action_id, name: :docs_cutover_trashed_doc_action_owner_fkey)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:deleted_by_id)
  end
end
