defmodule GroupherServer.CMS.Comments.AuthorRelationState do
  @moduledoc """
  Computes whether an Article author upvoted each Comment in a response page.

  This is a Comment response relation, not state of the current viewer, so it
  intentionally stays outside `CMS.Interactions.ReadState`.

      Comments Query -> AuthorRelationState -> author-upvoted comment ids
  """

  require GroupherServer.CMS.Model.Interaction.RoaringBitmap

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}

  alias CMS.Model.{Article, Author, Comment, CommentReactionInfo}
  alias CMS.Model.Interaction.RoaringBitmap

  @doc """
  Returns Comment ids upvoted by each Comment's parent Article author.

  Comments are grouped by thread so each parent Article table is joined with
  its Author in one query per thread.

  ## Examples

      upvoted_ids([comment])

  """
  @spec upvoted_ids([Comment.t()]) :: MapSet.t(integer())
  def upvoted_ids(comments) when is_list(comments) do
    upvoted_ids_for_articles(comments)
  end

  @doc """
  Returns Comment ids whose bitmap contains a known Article author id.

  Comment Query code uses this form when all Comments belong to one
  already-loaded Article.

  ## Examples

      upvoted_ids([comment.id], article_author_id)

  """
  @spec upvoted_ids([integer()], integer() | nil) :: MapSet.t(integer())
  def upvoted_ids(_comment_ids, nil), do: MapSet.new()

  def upvoted_ids(comment_ids, article_author_id)
      when is_list(comment_ids) and is_integer(article_author_id) do
    from(info in CommentReactionInfo,
      where: info.comment_id in ^Enum.uniq(comment_ids),
      where: RoaringBitmap.contains(info.upvoted_user_ids, ^article_author_id),
      select: info.comment_id
    )
    |> Repo.all()
    |> MapSet.new()
  end

  defp upvoted_ids_for_articles(comments) do
    comment_ids = Enum.map(comments, & &1.id)

    from(comment in Comment,
      join: article in Article,
      on: comment.article_id == article.id,
      join: author in Author,
      on: author.id == article.author_id,
      join: info in CommentReactionInfo,
      on: info.comment_id == comment.id,
      where: comment.id in ^comment_ids,
      where: RoaringBitmap.contains(info.upvoted_user_ids, author.user_id),
      select: comment.id
    )
    |> Repo.all()
    |> MapSet.new()
  end
end
