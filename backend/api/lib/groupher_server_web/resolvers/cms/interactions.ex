defmodule GroupherServerWeb.Resolvers.CMS.Interactions do
  @moduledoc """
  Adapts reaction, emotion, report, and private-state fields to CMS Interactions.

      GraphQL interaction field -> this resolver -> CMS.Interactions facade
  """

  import ShortMaps

  alias GroupherServer.CMS
  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Helper.EmotionFormatter

  @viewer_batch_size 100

  def report_article(_root, ~m(article reason attr)a, %{context: %{cur_user: user}}) do
    CMS.Interactions.report_result(article, reason, attr, user)
  end

  def undo_report_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_report_result(article, user)
  end

  def upvote_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.upvote_result(article, user, Map.get(args, :command_id))
  end

  def undo_upvote_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.Interactions.undo_upvote_result(article, user, Map.get(args, :command_id))
  end

  def upvoted_users(_root, ~m(article filter)a, _info) do
    CMS.Interactions.upvoted_users(article, filter)
  end

  def collected_users(_root, ~m(article filter)a, _info) do
    CMS.Interactions.collected_users(article, filter)
  end

  def emotion_to_article(_root, %{article: article, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.emotion_result(article, emotion, user, Map.get(args, :command_id))
  end

  def undo_emotion_to_article(_root, %{article: article, emotion: emotion} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.Interactions.undo_emotion_result(article, emotion, user, Map.get(args, :command_id))
  end

  def article_interaction_states(_root, %{paths: paths}, info) do
    with :ok <- validate_viewer_batch(paths) do
      case Map.get(info.context, :cur_user) do
        %User{} = user -> CMS.Interactions.article_states_for_paths(paths, user)
        _ -> {:ok, []}
      end
    end
  end

  def emotions(%{thread: _} = root, _args, _info) do
    {:ok, EmotionFormatter.format(root, :comment)}
  end

  def emotions(root, _args, _info) do
    {:ok, EmotionFormatter.format(root, :article)}
  end

  defp validate_viewer_batch(paths) when is_list(paths) and length(paths) <= @viewer_batch_size do
    :ok
  end

  defp validate_viewer_batch(_paths) do
    {:error, "viewer batch cannot contain more than 100 paths"}
  end
end
