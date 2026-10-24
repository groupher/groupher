defmodule GroupherServer.CMS.Model.ArticleReviewBlock do
  @moduledoc """
  CMS-owned review hold attached directly to an Article and review scope.

  Business position:

      CMS.ReviewBlocks
        -> ArticleReviewBlock
          -> direct Article and community scope hold
  """

  use Ecto.Schema

  import Ecto.Changeset
  alias GroupherServer.CMS
  alias CMS.Model.{Article, Community, ArtimentReview}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @types [:awaiting_ai, :awaiting_human, :ai_suspect, :manual_hold]
  @sources [:request, :human, :domain]

  @type t :: %__MODULE__{}

  schema "article_review_blocks" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:community, Community)
    field(:type, Ecto.Enum, values: @types)
    belongs_to(:artiment_review, ArtimentReview, type: Ecto.UUID)
    field(:item_id, :integer)
    field(:subject_ref, Ecto.UUID)
    field(:source_ref, :string)
    field(:source, Ecto.Enum, values: @sources)
    field(:applied_at, :utc_datetime)
    field(:resolved_at, :utc_datetime)
    field(:resolved_by_ref, Ecto.UUID)
    field(:resolution, :string)
    field(:version, :integer, default: 1)
    timestamps(type: :utc_datetime)
  end

  @doc "Validates a direct Article restriction and its paired resolution fields."
  def changeset(%__MODULE__{} = restriction, attrs) do
    restriction
    |> cast(attrs, [
      :article_id,
      :community_id,
      :type,
      :artiment_review_id,
      :item_id,
      :subject_ref,
      :source_ref,
      :source,
      :applied_at,
      :resolved_at,
      :resolved_by_ref,
      :resolution,
      :version
    ])
    |> validate_required([:article_id, :type, :source_ref, :source, :applied_at, :version])
    |> validate_number(:version, greater_than: 0)
    |> validate_resolution()
    |> unique_constraint([:article_id, :community_id, :source_ref],
      name: :article_review_blocks_active_system_source_index
    )
    |> unique_constraint([:article_id, :community_id, :source_ref],
      name: :article_review_blocks_active_community_source_index
    )
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:artiment_review_id)
    |> foreign_key_constraint(:item_id)
  end

  defp validate_resolution(changeset) do
    values = Enum.map([:resolved_at, :resolved_by_ref, :resolution], &get_field(changeset, &1))

    if Enum.all?(values, &is_nil/1) or Enum.all?(values, &(not is_nil(&1))) do
      changeset
    else
      add_error(changeset, :resolved_at, "resolution fields must be supplied together")
    end
  end
end
