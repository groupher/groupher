defmodule GroupherServer.CMS.Model.ArticleSnapshot do
  @moduledoc """
  Stored version checkpoint for article-like content.

  This schema is intentionally scoped to Groupher article threads: posts, docs,
  changelogs, and blogs. Comments are not part of this model.

  A row stores a full document snapshot rather than a patch. Draft and public
  snapshots share the same `doc_id`, which points at the stable docs identity.

  `stage` describes which version produced the snapshot. Review state belongs
  to `publish_requests`; it is not a content stage.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads

  alias CMS.Model.{Author, Community}

  alias Helper.Constant.DBPrefix

  require CMS.Const

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @max_subtitle_length 240
  @required_fields ~w(community_id article_thread stage title document_json content_hash snapshot_number)a
  @optional_fields ~w(doc_id author_id slug subtitle digest schema_version)a

  @type snapshot_stage :: :draft | :public
  @type t :: %ArticleSnapshot{}

  schema "article_snapshots" do
    belongs_to(:community, Community)
    belongs_to(:author, Author)

    field(:doc_id, Ecto.UUID)
    field(:article_thread, Ecto.Enum, values: Threads.article_enums())
    field(:stage, Ecto.Enum, values: CMS.Const.stage_values())
    field(:title, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:digest, :string)
    field(:document_json, :string)
    field(:content_hash, :string)
    field(:snapshot_number, :integer)
    field(:schema_version, :integer, default: 1)

    timestamps(type: :utc_datetime)
  end

  def stages, do: CMS.Const.stage_enum_values()

  def changeset(%ArticleSnapshot{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:stage, CMS.Const.stage_enum_values())
    |> validate_length(:title, min: 1, max: 100)
    |> validate_length(:subtitle, max: @max_subtitle_length)
    |> validate_target()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:author_id)
    |> check_constraint(:doc_id, name: :article_snapshots_target_check)
    |> check_constraint(:stage, name: :article_snapshots_stage_check)
    |> check_constraint(:article_thread, name: :article_snapshots_article_thread_check)
  end

  def update_changeset(%ArticleSnapshot{} = snapshot, attrs), do: changeset(snapshot, attrs)

  defp validate_target(changeset) do
    case {get_field(changeset, :stage), get_field(changeset, :doc_id)} do
      {stage, doc_id} when stage in CMS.Const.stage_values() and not is_nil(doc_id) ->
        changeset

      {stage, nil} when stage in CMS.Const.stage_values() ->
        add_error(changeset, :doc_id, "#{stage} snapshots require doc_id")

      _ ->
        add_error(changeset, :stage, "invalid snapshot target")
    end
  end
end
