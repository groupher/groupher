defmodule GroupherServer.CMS.Interactions.DefaultViewerState do
  @moduledoc """
  Defines the zero-value fragments used to assemble Interaction read state.

  The response shapes live in one module because Article, Comment, emotion,
  and moderation state are field combinations, not separate domain models.

      ReadState.Query -> DefaultViewerState -> viewer-facing map
  """

  alias GroupherServer.CMS.Artiment.Config

  @doc """
  Returns the default Article interaction fields.

  ## Examples

      DefaultViewerState.article()

  """
  @spec article() :: map()
  def article do
    %{
      upvotes_count: 0,
      collects_count: 0,
      latest_upvoted_users: [],
      latest_collected_users: [],
      emotions: emotions(:article),
      viewer_has_upvoted: false,
      viewer_has_collected: false,
      viewer_has_reported: false,
      viewer_has_viewed: false
    }
  end

  @doc """
  Returns the default Comment interaction fields.

  ## Examples

      DefaultViewerState.comment()

  """
  @spec comment() :: map()
  def comment do
    %{
      upvotes_count: 0,
      latest_upvoted_users: [],
      emotions: emotions(:comment),
      viewer_has_upvoted: false,
      viewer_has_reported: false
    }
  end

  @doc """
  Returns the complete default emotion vocabulary for an Article or Comment.

  ## Examples

      DefaultViewerState.emotions(:comment)

  """
  @spec emotions(:article | :comment) :: [map()]
  def emotions(kind) when kind in [:article, :comment] do
    vocabulary = if kind == :article, do: Config.emotions(), else: Config.comment_emotions()

    Enum.map(vocabulary, fn emotion ->
      %{
        emotion: emotion,
        count: 0,
        latest_users: [],
        viewer_has_reacted: false
      }
    end)
  end

  @doc """
  Returns the moderation-only default fields.

  ## Examples

      DefaultViewerState.report()

  """
  @spec report() :: %{reported_count: 0}
  def report, do: %{reported_count: 0}
end
