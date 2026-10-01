defmodule GroupherServer.CMS.Model.PinnedComment do
  @moduledoc """
  Ecto schema for pinned comments.

  Pin records keep presentation ordering separate from the comment's own content
  and reply state.

  Business position:

      CMS context
        -> PinnedComment schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  alias __MODULE__
  alias GroupherServer.CMS.Model.{Article, Comment, DocBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  # alias Helper.HTML
  @required_fields ~w(comment_id article_id)a
  @optional_fields ~w(branch_id)a
  @type t :: %__MODULE__{}

  schema "pinned_comments" do
    belongs_to(:comment, Comment, foreign_key: :comment_id)
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)

    timestamps(type: :utc_datetime)
  end

  @doc false
  @spec changeset(t(), map()) :: Ecto.Changeset.t(t())
  def changeset(%PinnedComment{} = article_pined_comment, attrs) do
    article_pined_comment
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:comment_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> stable_unique_constraints()
  end

  # @doc false
  def update_changeset(%PinnedComment{} = article_pined_comment, attrs) do
    article_pined_comment
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> foreign_key_constraint(:comment_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> stable_unique_constraints()
  end

  defp stable_unique_constraints(changeset) do
    changeset
    |> unique_constraint([:article_id, :comment_id],
      name: :pinned_comments_stable_article_target_index
    )
    |> unique_constraint([:article_id, :branch_id, :comment_id],
      name: :pinned_comments_stable_doc_target_index
    )
  end
end
