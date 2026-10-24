defmodule GroupherServer.CMS.Model.Embeds.CommentMeta do
  @type t :: %__MODULE__{}

  @moduledoc """
  Embedded reply metadata for a comment.

  Business position:

      CMS context
        -> CommentMeta schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  @optional_fields ~w(is_article_author_upvoted is_reply_to_others)a

  @doc "for test usage"
  def default_meta do
    %{
      is_article_author_upvoted: false,
      is_reply_to_others: false
    }
  end

  embedded_schema do
    field(:is_article_author_upvoted, :boolean, default: false)
    # used in replies mode, for those reply to other user in replies box (for frontend)
    # 用于回复模式，指代这条回复是回复“回复列表其他人的” （方便前端展示）
    field(:is_reply_to_others, :boolean, default: false)
  end

  def changeset(struct, params) do
    struct
    |> cast(params, @optional_fields)
  end
end
