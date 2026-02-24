defmodule GroupherServer.CMS.Comments.Read do
  @moduledoc """
  Read operations for comments.
  """

  import Ecto.Query, warn: false

  import Helper.Utils, only: [done: 1, get_config: 2]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.FrontDesk
  alias CMS.Model.Comment
  alias Helper.Types, as: T

  @article_threads get_config(:article, :threads)

  @spec fetch_comment(T.id()) :: T.domain_res(Comment.t())
  def fetch_comment(comment_id) do
    FrontDesk.get(Comment, comment_id)
  end

  @spec fetch_full_comment(T.id()) :: T.domain_res(T.article_info())
  def fetch_full_comment(comment_id) do
    get_full_comment(comment_id)
  end

  @spec one_comment(T.id()) :: T.domain_res(Comment.t())
  def one_comment(id), do: FrontDesk.get(Comment, id)

  @spec one_comment(T.id(), User.t()) :: T.domain_res(Comment.t())
  def one_comment(id, %User{} = user) do
    with {:ok, comment} <- FrontDesk.get(Comment, id) do
      %{entries: [comment]}
      |> FrontDesk.mark_viewer_emotion_states(user)
      |> mark_viewer_has_upvoted(user)
      |> Map.get(:entries)
      |> List.first()
      |> done
    end
  end

  @spec get_full_comment(T.id()) :: T.domain_res(T.article_info())
  defp get_full_comment(comment_id) do
    query = from(c in Comment, where: c.id == ^comment_id, preload: ^@article_threads)

    with {:ok, comment} <- Repo.one(query) |> done(),
         article_thread <- find_comment_article_thread(comment) do
      do_extract_article_info(article_thread, Map.get(comment, article_thread))
    end
  end

  defp do_extract_article_info(thread, article) do
    with {:ok, article_with_author} <- Repo.preload(article, author: :user) |> done(),
         article_author <- get_in(article_with_author, [:author, :user]) do
      article_info = %{title: article.title, id: article.id}

      author_info = %{
        id: article_author.id,
        login: article_author.login,
        nickname: article_author.nickname
      }

      {:ok, %{thread: thread, article: article_info, author: author_info}}
    end
  end

  defp find_comment_article_thread(%Comment{} = comment) do
    @article_threads
    |> Enum.filter(&Map.get(comment, :"#{&1}_id"))
    |> List.first()
  end

  defp mark_viewer_has_upvoted(%{entries: entries} = paged_comments, %User{} = user) do
    entries =
      Enum.map(
        entries,
        fn comment ->
          replies =
            Enum.map(comment.replies, fn reply_comment ->
              Map.merge(reply_comment, %{
                viewer_has_upvoted: Enum.member?(reply_comment.meta.upvoted_user_ids, user.id)
              })
            end)

          Map.merge(comment, %{
            viewer_has_upvoted: Enum.member?(comment.meta.upvoted_user_ids, user.id),
            replies: replies
          })
        end
      )

    Map.merge(paged_comments, %{entries: entries})
  end
end
