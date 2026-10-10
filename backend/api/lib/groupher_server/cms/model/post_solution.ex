defmodule GroupherServer.CMS.Model.PostSolution do
  @moduledoc """
  Authoritative accepted-answer binding for one Post.

  This row is the single current fact used to distinguish accept, replace and
  revoke transitions. Comment/Post response fields are virtual Query
  projections; pin and workflow status remain independent domains.

      Comments Command -> PostSolution authority -> batched Query projections
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Article, Comment}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @type t :: %__MODULE__{}

  schema "post_solutions" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:comment, Comment)
    belongs_to(:accepted_by, User)
    field(:accepted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc """
  Validates one live solution binding written by the Comments command.

  ## Examples

      PostSolution.changeset(%PostSolution{}, attrs)
  """
  @spec changeset(t(), map()) :: Ecto.Changeset.t(t())
  def changeset(solution, attrs) do
    solution
    |> cast(attrs, [:article_id, :comment_id, :accepted_by_id, :accepted_at])
    |> validate_required([:article_id, :comment_id, :accepted_by_id, :accepted_at])
    |> unique_constraint(:article_id)
    |> unique_constraint(:comment_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:comment_id)
    |> foreign_key_constraint(:comment_id,
      name: :post_solutions_comment_belongs_to_article_fkey,
      message: "must belong to the selected post"
    )
    |> foreign_key_constraint(:accepted_by_id)
  end
end
