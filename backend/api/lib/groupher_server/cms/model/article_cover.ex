defmodule GroupherServer.CMS.Model.DraftCoverEdit do
  @moduledoc """
  Mutable cover canvas state owned by one Article body Draft.

      editor cover state -> DraftCoverEdit -> Publish snapshot
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{ArticleBodyDraft, CoverBackground}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @fields ~w(body_draft_id canvas_width canvas_height version light_background_id
             light_original_background_id light_images dark_background_id
             dark_original_background_id dark_images)a

  @type t :: %__MODULE__{}

  schema "draft_cover_edits" do
    belongs_to(:body_draft, ArticleBodyDraft, type: Ecto.UUID, primary_key: true)
    belongs_to(:light_background, CoverBackground)
    belongs_to(:light_original_background, CoverBackground)
    field(:light_images, {:array, :map}, default: [])
    belongs_to(:dark_background, CoverBackground)
    belongs_to(:dark_original_background, CoverBackground)
    field(:dark_images, {:array, :map}, default: [])
    field(:canvas_width, :integer)
    field(:canvas_height, :integer)
    field(:version, :integer, default: 1)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the mutable Draft cover canvas changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = edit, attrs) do
    edit
    |> cast(attrs, @fields)
    |> validate_required([:body_draft_id, :version])
    |> foreign_key_constraint(:body_draft_id)
    |> foreign_key_constraint(:light_background_id)
    |> foreign_key_constraint(:light_original_background_id)
    |> foreign_key_constraint(:dark_background_id)
    |> foreign_key_constraint(:dark_original_background_id)
  end
end

defmodule GroupherServer.CMS.Model.RevisionCover do
  @moduledoc """
  Immutable light or dark cover asset selected by one Revision.

      Draft cover selection -> Publish -> RevisionCover
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{ArticleRevision, CommunityAsset}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  schema "revision_covers" do
    belongs_to(:revision, ArticleRevision, type: Ecto.UUID)
    belongs_to(:asset, CommunityAsset)
    field(:theme, Ecto.Enum, values: [:light, :dark])
  end

  @doc "Builds an immutable Revision cover selection changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = cover, attrs) do
    cover
    |> cast(attrs, [:revision_id, :asset_id, :theme])
    |> validate_required([:revision_id, :asset_id, :theme])
    |> foreign_key_constraint(:revision_id)
    |> foreign_key_constraint(:asset_id)
    |> unique_constraint([:revision_id, :theme])
  end
end

defmodule GroupherServer.CMS.Model.RevisionCoverEdit do
  @moduledoc """
  Immutable cover canvas snapshot owned by one Article Revision.

      DraftCoverEdit -> Publish snapshot -> RevisionCoverEdit
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{ArticleRevision, CoverBackground}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @fields ~w(revision_id canvas_width canvas_height version light_background_id
             light_original_background_id light_images dark_background_id
             dark_original_background_id dark_images)a
  @type t :: %__MODULE__{}

  schema "revision_cover_edits" do
    belongs_to(:revision, ArticleRevision, type: Ecto.UUID, primary_key: true)
    belongs_to(:light_background, CoverBackground)
    belongs_to(:light_original_background, CoverBackground)
    field(:light_images, {:array, :map}, default: [])
    belongs_to(:dark_background, CoverBackground)
    belongs_to(:dark_original_background, CoverBackground)
    field(:dark_images, {:array, :map}, default: [])
    field(:canvas_width, :integer)
    field(:canvas_height, :integer)
    field(:version, :integer, default: 1)
  end

  @doc "Builds an immutable Revision cover canvas changeset."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = edit, attrs) do
    edit
    |> cast(attrs, @fields)
    |> validate_required([:revision_id, :version])
    |> foreign_key_constraint(:revision_id)
    |> foreign_key_constraint(:light_background_id)
    |> foreign_key_constraint(:light_original_background_id)
    |> foreign_key_constraint(:dark_background_id)
    |> foreign_key_constraint(:dark_original_background_id)
  end
end
