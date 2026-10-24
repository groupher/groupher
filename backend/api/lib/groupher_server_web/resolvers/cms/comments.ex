defmodule GroupherServerWeb.Resolvers.CMS.Comments do
  @moduledoc """
  Adapts Comment queries and mutations to public CMS comment use cases.

      GraphQL Comment field -> this resolver -> CMS.Comments facade
  """

  import ShortMaps

  alias GroupherServer.Accounts

  alias GroupherServer.Pagi
  alias GroupherServer.CMS
  alias Accounts.Model.User
  alias CMS.Model.Community

  @viewer_batch_size 100

  def lock_article_comments(_root, ~m(article command_id)a, %{context: %{cur_user: user}}) do
    CMS.articles_lock_comments_result(article, user, command_id)
  end

  def undo_lock_article_comments(_root, ~m(article command_id)a, %{context: %{cur_user: user}}) do
    CMS.articles_undo_lock_comments_result(article, user, command_id)
  end

  def comments_state(_root, %{article: article, article_path: %{thread: thread}}, %{
        context: %{cur_user: user}
      }) do
    CMS.comments_comments_state(thread, article.id, user)
  end

  def comments_state(_root, %{article: article, article_path: %{thread: thread}}, _) do
    CMS.comments_comments_state(thread, article.id)
  end

  def comment_viewer_states(
        _root,
        %{article: article_path, comment_inner_ids: comment_inner_ids},
        info
      ) do
    with {:ok, :pass} <- validate_viewer_batch(comment_inner_ids) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> CMS.comments_viewer_states(article_path, comment_inner_ids, user)
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
      CMS.comments_reconcile_states(article_path, comment_inner_ids, viewer)
    end
  end

  def one_comment(_root, %{comment: comment}, %{context: %{cur_user: user}}) do
    CMS.comments_one_comment(comment, user)
  end

  def one_comment(_root, %{comment: comment}, _) do
    CMS.comments_one_comment(comment)
  end

  @doc "Resolves the canonical CommentPage with an independent PagiInput."
  def comment_page(
        _root,
        %{
          article: article,
          article_path: %{community: community, thread: thread}
        } = args,
        %{context: context}
      ) do
    filter = Map.get(args, :filter) || %{}
    mode = Map.get(args, :mode, :replies)
    pagi_input = Map.get(args, :pagi)

    CMS.comments_page(
      thread,
      article.id,
      community,
      filter,
      pagi_input,
      mode,
      Map.get(context, :cur_user)
    )
  end

  def paged_comments_participants(
        _root,
        %{article: article, article_path: %{thread: thread}} = args,
        _info
      ) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.comments_paged_comments_participants(thread, article.id, pagi)
    end
  end

  def create_comment(
        _root,
        %{
          article: article,
          article_path: %{community: community_slug, thread: thread},
          body_bag: body_bag
        } = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, %Community{} = community} <-
           GroupherServer.CMS.front_desk_community(community_slug) do
      article = article |> Map.delete(:__struct__) |> Map.put(:community, community)

      CMS.comments_create_comment_result(
        thread,
        article,
        body_bag,
        user,
        Map.get(args, :command_id)
      )
    end
  end

  def update_comment(_root, ~m(body_bag comment expected_version)a = args, %{
        context: %{cur_user: user}
      }) do
    CMS.comments_update_comment_result(
      comment,
      body_bag,
      expected_version,
      user,
      Map.get(args, :command_id)
    )
  end

  def delete_comment(_root, ~m(comment)a = args, %{context: %{cur_user: user}}) do
    CMS.comments_delete_comment_result(comment, user, Map.get(args, :command_id))
  end

  def reply_comment(_root, %{comment: comment, body_bag: body_bag} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.comments_reply_comment_result(comment, body_bag, user, Map.get(args, :command_id))
  end

  def upvote_comment(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.interactions_upvote_result(comment, user, Map.get(args, :command_id))
  end

  def undo_upvote_comment(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.interactions_undo_upvote_result(comment, user, Map.get(args, :command_id))
  end

  def emotion_to_comment(_root, %{comment: comment, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.interactions_emotion_result(comment, emotion, user, Map.get(args, :command_id))
  end

  def undo_emotion_to_comment(_root, %{comment: comment, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.interactions_undo_emotion_result(comment, emotion, user, Map.get(args, :command_id))
  end

  def accept_solution(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.comments_accept_solution(comment, user, Map.get(args, :command_id))
  end

  def revoke_solution(_root, %{comment: comment} = args, %{context: %{cur_user: user}}) do
    CMS.comments_revoke_solution(comment, user, Map.get(args, :command_id))
  end

  def pin_comment(_root, ~m(comment)a = args, %{context: %{cur_user: user}}) do
    CMS.comments_pin_comment(comment, user, Map.get(args, :command_id))
  end

  def undo_pin_comment(_root, ~m(comment)a = args, %{context: %{cur_user: user}}) do
    CMS.comments_undo_pin_comment(comment, user, Map.get(args, :command_id))
  end

  def comment_inner_id(%{inner_id: inner_id}, _args, _info) when not is_nil(inner_id) do
    {:ok, inner_id}
  end

  def comment_inner_id(_comment, _args, _info) do
    {:ok, nil}
  end

  @doc "Resolves an independent reply collection; FrontDesk supplies the canonical comment."
  def comment_reply_page(
        _root,
        %{comment: comment, comment_path: %{article: %{community: community}}} = args,
        %{context: context}
      ) do
    CMS.comments_reply_page(
      comment,
      community,
      Map.get(args, :filter) || %{},
      Map.get(args, :pagi),
      Map.get(context, :cur_user)
    )
  end

  defp validate_viewer_batch(paths) when is_list(paths) and length(paths) <= @viewer_batch_size do
    {:ok, :pass}
  end

  defp validate_viewer_batch(_paths) do
    {:error, "viewer batch cannot contain more than 100 paths"}
  end
end
