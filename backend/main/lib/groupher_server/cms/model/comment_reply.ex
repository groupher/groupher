defmodule GroupherServer.CMS.Model.CommentReply do
  @moduledoc """
  Ecto schema for reply relationships between comments.

  The row links a comment to the comment it replies to so reply trees can be
  queried without overloading the main comment record.

  Business position:

      CMS context
        -> CommentReply schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Comment
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @required_fields ~w(comment_id reply_to_comment_id)a

  @type t :: %CommentReply{}
  schema "comments_replies" do
    belongs_to(:comment, Comment, foreign_key: :comment_id)
    belongs_to(:reply_to_comment, Comment, foreign_key: :reply_to_comment_id)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%CommentReply{} = comment_reply, attrs) do
    comment_reply
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:comment_id)
    |> foreign_key_constraint(:reply_to_comment_id)
  end
end
