defmodule GroupherServer.CMS.Model.PinnedComment do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import Helper.Utils, only: [get_config: 2]
  import GroupherServer.CMS.Helper.Macros

  import GroupherServer.CMS.Helper.Constraints,
    only: [articles_exactly_one_ref_constraint: 2, articles_foreign_key_constraint: 1]

  alias GroupherServer.CMS

  alias CMS.Model.Comment
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  # alias Helper.HTML
  @article_threads get_config(:article, :threads)

  @required_fields ~w(comment_id)a
  # @optional_fields ~w(post_id job_id repo_id)a

  @article_fields @article_threads |> Enum.map(&:"#{&1}_id")

  schema_base_type(comment_id: integer() | nil)

  schema "pinned_comments" do
    belongs_to(:comment, Comment, foreign_key: :comment_id)

    article_belongs_to_fields()
    timestamps(type: :utc_datetime)
  end

  @doc false
  @spec changeset(t(), map()) :: Ecto.Changeset.t(t())
  def changeset(%PinnedComment{} = article_pined_comment, attrs) do
    article_pined_comment
    |> cast(attrs, @required_fields ++ @article_fields)
    |> validate_required(@required_fields)
    |> articles_foreign_key_constraint
    |> articles_exactly_one_ref_constraint(:pinned_comments)
    |> unique_article_comment_constraint()
  end

  # @doc false
  def update_changeset(%PinnedComment{} = article_pined_comment, attrs) do
    article_pined_comment
    |> cast(attrs, @required_fields ++ @article_fields)
    |> articles_foreign_key_constraint
    |> articles_exactly_one_ref_constraint(:pinned_comments)
    |> unique_article_comment_constraint()
  end

  defp unique_article_comment_constraint(%Ecto.Changeset{} = changeset) do
    Enum.reduce(@article_fields, changeset, fn article_field, acc ->
      unique_constraint(acc, :comment_id,
        name: :"pinned_comments_#{article_field}_comment_id_index"
      )
    end)
  end
end
