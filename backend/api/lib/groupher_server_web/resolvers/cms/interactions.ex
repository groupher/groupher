defmodule GroupherServerWeb.Resolvers.CMS.Interactions do
  @moduledoc """
  Adapts reaction, emotion, report, and private-state fields to CMS Interactions.

      GraphQL interaction field -> this resolver -> CMS.Interactions facade
  """

  alias GroupherServer.Accounts

  alias GroupherServer.Pagi
  alias GroupherServer.CMS
  alias Accounts.Model.User

  @viewer_batch_size 100

  def upvote_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.interactions_upvote_result(article, user, Map.get(args, :command_id))
  end

  def undo_upvote_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.interactions_undo_upvote_result(article, user, Map.get(args, :command_id))
  end

  def upvoted_users(_root, %{article: article} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.interactions_upvoted_users(article, pagi)
    end
  end

  def collected_users(_root, %{article: article} = args, _info) do
    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.interactions_collected_users(article, pagi)
    end
  end

  def emotion_to_article(_root, %{article: article, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.interactions_emotion_result(article, emotion, user, Map.get(args, :command_id))
  end

  def undo_emotion_to_article(_root, %{article: article, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.interactions_undo_emotion_result(article, emotion, user, Map.get(args, :command_id))
  end

  def article_interaction_states(_root, %{paths: paths}, info) do
    with {:ok, :pass} <- validate_viewer_batch(paths) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> CMS.interactions_article_states_for_paths(paths, user)
        _ -> {:ok, []}
      end
    end
  end

  def emotions(%{thread: _} = root, _args, _info) do
    {:ok, CMS.format_emotions(root, :comment)}
  end

  def emotions(root, _args, _info) do
    {:ok, CMS.format_emotions(root, :article)}
  end

  defp validate_viewer_batch(paths) when is_list(paths) and length(paths) <= @viewer_batch_size do
    {:ok, :pass}
  end

  defp validate_viewer_batch(_paths) do
    {:error, "viewer batch cannot contain more than 100 paths"}
  end
end
