defmodule GroupherServer.CMS.Model.PostSolution do
  @moduledoc """
  Authoritative accepted-answer relation for one Post.

  Comment flags and Post digest/status are projections maintained by the
  Comments command; this row is the single current fact used to distinguish
  accept, replace and revoke transitions.

      Comments command -> PostSolution authority -> Post and Comment projections
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Comment, Post}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  schema "post_solutions" do
    belongs_to(:post, Post)
    belongs_to(:comment, Comment)
    belongs_to(:accepted_by, User)
    field(:accepted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  def changeset(solution, attrs) do
    solution
    |> cast(attrs, [:post_id, :comment_id, :accepted_by_id, :accepted_at])
    |> validate_required([:post_id, :comment_id, :accepted_by_id, :accepted_at])
    |> unique_constraint(:post_id)
    |> foreign_key_constraint(:post_id)
    |> foreign_key_constraint(:comment_id)
    |> foreign_key_constraint(:accepted_by_id)
  end
end
