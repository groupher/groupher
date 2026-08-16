defmodule GroupherServer.CMS.Model.DocPublishRelease do
  @moduledoc """
  Site-level docs publish checkpoint.

      Dashboard editor
      ├─ tree changes     -> doc_tree_nodes(stage=public)
      └─ article changes  -> runtime docs + ArticleDocument
             |
             v
      publish_changes/3 creates one DocPublishRelease
             |
             ├─ tree_snapshot_id           # complete tree_json lives there
             ├─ doc_publish_release_articles     # article snapshots in this release
             └─ doc_publish_release_tree_events  # tree events included in this release

  `DocPublishRelease` is the cross-domain anchor that the separate tree and article
  snapshot lines intentionally do not provide. A release answers "what did the
  public docs site look like after this publish?" without duplicating article
  JSON or tree JSON in this table.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  alias CMS.Model.{
    Community,
    DocBranch,
    DocTreeSnapshot,
    DocPublishReleaseArticle,
    DocPublishReleaseTreeEvent
  }

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id branch_id release_number version_slug tree_snapshot_id published_at)a
  @optional_fields ~w(author_id)a

  @type t :: %DocPublishRelease{}
  schema "doc_publish_releases" do
    belongs_to(:community, Community)
    belongs_to(:branch, DocBranch)
    belongs_to(:tree_snapshot, DocTreeSnapshot)
    belongs_to(:author, User)
    has_many(:articles, DocPublishReleaseArticle, foreign_key: :release_id)
    has_many(:tree_events, DocPublishReleaseTreeEvent, foreign_key: :release_id)

    field(:release_number, :integer)
    field(:version_slug, :string)
    field(:published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc "Builds a Docs-only publish release changeset."
  def changeset(%DocPublishRelease{} = release, attrs) do
    release
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:release_number, greater_than: 0)
    |> validate_length(:version_slug, min: 1, max: 80)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:tree_snapshot_id)
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:release_number, name: :doc_publish_releases_branch_number_index)
    |> unique_constraint(:version_slug, name: :doc_publish_releases_branch_version_slug_index)
  end
end
