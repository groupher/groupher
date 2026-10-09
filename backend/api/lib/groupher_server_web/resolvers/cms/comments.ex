defmodule GroupherServerWeb.Resolvers.CMS.Comments do
  @moduledoc """
  Adapts Comment queries and mutations to public CMS comment use cases.

      GraphQL Comment field -> this resolver -> CMS.Comments facade
  """

  import ShortMaps

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Community

  @viewer_batch_size 100

  def lock_article_comments(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.lock_comments_result(article, user)
  end

  def undo_lock_article_comments(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.undo_lock_comments_result(article, user)
  end

  def comments_state(_root, %{article: article, article_path: %{thread: thread}}, %{
        context: %{cur_user: user}
      }) do
    CMS.Comments.comments_state(thread, article.id, user)
  end

  def comments_state(_root, %{article: article, article_path: %{thread: thread}}, _) do
    CMS.Comments.comments_state(thread, article.id)
  end

  def comment_viewer_states(
        _root,
        %{article: article_path, comment_inner_ids: comment_inner_ids},
        info
      ) do
    with {:ok, :pass} <- validate_viewer_batch(comment_inner_ids) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> CMS.Comments.viewer_states(article_path, comment_inner_ids, user)
        _ -> {:ok, []}
      end
    end
  end

  def comment_reconcile_states(
        _root,
        %{article: article_path, comment_inner_ids: comment_inner_ids},
        info
      ) do
    with {:ok, :pass} <- validate_viewer_batch(comment_inner_ids),
         viewer <- Map.get(info.context, :cur_user) do
      CMS.Comments.reconcile_states(article_path, comment_inner_ids, viewer)
    end
  end

  def one_comment(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.one_comment(comment, user)
  end

  def one_comment(_root, %{comment: comment}, _) do
    CMS.Comments.one_comment(comment)
  end

  def paged_comments(
        _root,
        %{article: article, article_path: %{thread: thread}, filter: filter, mode: mode},
        %{context: %{cur_user: user}}
      ) do
    CMS.Comments.paged_comments(thread, article.id, filter, mode, user)
  end

  def paged_comments(
        _root,
        %{article: article, article_path: %{thread: thread}, filter: filter, mode: mode},
        _info
      ) do
    CMS.Comments.paged_comments(thread, article.id, filter, mode)
  end

  def paged_comments_participants(
        _root,
        %{article: article, article_path: %{thread: thread}, filter: filter},
        _info
      ) do
    CMS.Comments.paged_comments_participants(thread, article.id, filter)
  end

  def create_comment(
        _root,
        %{
          article: article,
          article_path: %{community: community_slug, thread: thread},
          body: body
        } = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, %Community{} = community} <- CMS.FrontDesk.community(community_slug) do
      article = article |> Map.delete(:__struct__) |> Map.put(:community, community)

      CMS.Comments.create_comment_result(
        thread,
        article,
        body,
        user,
        Map.get(args, :command_id)
      )
    end
  end

  def update_comment(_root, ~m(body comment)a = args, %{context: %{cur_user: user}}) do
    CMS.Comments.update_comment_result(comment, body, user, Map.get(args, :command_id))
  end

  def delete_comment(_root, ~m(comment)a = args, %{context: %{cur_user: user}}) do
    CMS.Comments.delete_comment_result(comment, user, Map.get(args, :command_id))
  end

  def reply_comment(_root, %{comment: comment, body: body} = args, %{context: %{cur_user: user}}) do
    CMS.Comments.reply_comment_result(comment, body, user, Map.get(args, :command_id))
  end

  def upvote_comment(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.upvote_result(comment, user, Map.get(args, :command_id))
  end

  def undo_upvote_comment(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_upvote_result(comment, user, Map.get(args, :command_id))
  end

  def report_comment(_root, ~m(comment reason attr)a = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.report_result(comment, reason, attr, user, Map.get(args, :command_id))
  end

  def undo_report_comment(_root, ~m(comment)a = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_report_result(comment, user, Map.get(args, :command_id))
  end

  def emotion_to_comment(_root, %{comment: comment, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.emotion_result(comment, emotion, user, Map.get(args, :command_id))
  end

  def undo_emotion_to_comment(_root, %{comment: comment, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.undo_emotion_result(comment, emotion, user, Map.get(args, :command_id))
  end

  def accept_solution(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.accept_solution(comment, user)
  end

  def revoke_solution(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.Comments.revoke_solution(comment, user)
  end

  def pin_comment(_root, ~m(comment)a, %{context: %{cur_user: user}}) do
    CMS.Comments.pin_comment(comment, user)
  end

  def undo_pin_comment(_root, ~m(comment)a, %{context: %{cur_user: user}}) do
    CMS.Comments.undo_pin_comment(comment, user)
  end

  def comment_inner_id(%{inner_id: inner_id}, _args, _info) when not is_nil(inner_id) do
    {:ok, inner_id}
  end

  def comment_inner_id(_comment, _args, _info) do
    {:ok, nil}
  end

  def paged_comment_replies(_root, %{comment: comment, filter: filter}, %{
        context: %{cur_user: user}
      }) do
    CMS.Comments.paged_comment_replies(comment.id, filter, user)
  end

  def paged_comment_replies(_root, %{comment: comment, filter: filter}, _info) do
    CMS.Comments.paged_comment_replies(comment.id, filter)
  end

  defp validate_viewer_batch(paths) when is_list(paths) and length(paths) <= @viewer_batch_size do
    {:ok, :pass}
  end

  defp validate_viewer_batch(_paths) do
    {:error, "viewer batch cannot contain more than 100 paths"}
  end
end
