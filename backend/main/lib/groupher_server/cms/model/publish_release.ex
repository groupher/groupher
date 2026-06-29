defmodule GroupherServer.CMS.Model.PublishRelease do
  @moduledoc """
  Site-level docs publish checkpoint.

      Dashboard editor
      ├─ tree changes     -> doc_tree_nodes(stage=public)
      └─ article changes  -> runtime docs + DocDocument
             |
             v
      publish_changes/3 creates one PublishRelease
             |
             ├─ tree_snapshot_id           # complete tree_json lives there
             ├─ publish_release_articles     # article snapshots in this release
             └─ publish_release_tree_events  # tree events included in this release

  `PublishRelease` is the cross-domain anchor that the separate tree and article
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
  alias CMS.Model.{Community, DocTreeSnapshot, PublishReleaseArticle, PublishReleaseTreeEvent}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id release_number tree_snapshot_id published_at)a
  @optional_fields ~w(author_id)a

  @type t :: %PublishRelease{}
  schema "publish_releases" do
    belongs_to(:community, Community)
    belongs_to(:tree_snapshot, DocTreeSnapshot)
    belongs_to(:author, User)
    has_many(:articles, PublishReleaseArticle, foreign_key: :release_id)
    has_many(:tree_events, PublishReleaseTreeEvent, foreign_key: :release_id)

    field(:release_number, :integer)
    field(:published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%PublishRelease{} = release, attrs) do
    release
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:release_number, greater_than: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:tree_snapshot_id)
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:release_number, name: :publish_releases_community_number_index)
  end
end
