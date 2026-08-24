defmodule GroupherServer.CMS.Model.PostSolution do
  @moduledoc """
  Authoritative accepted-answer relation for one Post.

  This row is the single current fact used to distinguish accept, replace and
  revoke transitions. Comment/Post response fields are virtual Reader
  projections; pin and workflow status remain independent domains.

      Comments Command -> PostSolution authority -> batched Reader projections
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Comment, Post}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @type t :: %__MODULE__{}

  schema "post_solutions" do
    belongs_to(:post, Post)
    belongs_to(:comment, Comment)
    belongs_to(:accepted_by, User)
    field(:accepted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @doc """
  Validates one live solution relation written by the Comments command.

  ## Examples

      PostSolution.changeset(%PostSolution{}, attrs)
  """
  @spec changeset(t(), map()) :: Ecto.Changeset.t(t())
  def changeset(solution, attrs) do
    solution
    |> cast(attrs, [:post_id, :comment_id, :accepted_by_id, :accepted_at])
    |> validate_required([:post_id, :comment_id, :accepted_by_id, :accepted_at])
    |> unique_constraint(:post_id)
    |> unique_constraint(:comment_id)
    |> foreign_key_constraint(:post_id)
    |> foreign_key_constraint(:comment_id)
    |> foreign_key_constraint(:comment_id,
      name: :post_solutions_comment_belongs_to_post_fkey,
      message: "must belong to the selected post"
    )
    |> foreign_key_constraint(:accepted_by_id)
  end
end
