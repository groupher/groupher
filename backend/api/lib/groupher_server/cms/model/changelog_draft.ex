defmodule GroupherServer.CMS.Model.ChangelogDraft do
  @moduledoc """
  Mutable Changelog-only fields owned by an ordinary Article Draft.

      Changelog editor -> ChangelogDraft -> ChangelogRevision
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Article
  alias Helper.Constant.DBPrefix

  @primary_key false
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @fields ~w(article_id copy_right link_addr cover_url cover_url_dark)a
  @type t :: %__MODULE__{}

  schema "changelog_drafts" do
    belongs_to(:article, Article, primary_key: true)
    field(:copy_right, :string)
    field(:link_addr, :string)
    field(:cover_url, :string)
    field(:cover_url_dark, :string)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the typed Changelog Draft extension changed by editor autosave."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = draft, attrs) do
    draft
    |> cast(attrs, @fields)
    |> validate_required([:article_id])
    |> foreign_key_constraint(:article_id)
  end
end
