defmodule GroupherServer.Activity.Workflow do
  @moduledoc """
  Context boundary for append-only business Activity and its safe product views.

      CMS / Accounts / Jobs
        -> Activity.log/3
        -> thread or resource-specific append-only stream
        -> ArticleLog / CommunityLog projection

  Activity records business facts. It never owns or reconstructs current
  business state.
  """

  alias GroupherServer.{Activity, CMS}
  alias Activity.{Artiment, CommunityLog, ArticleLog, ErrorCat}
  alias CMS.Model.{Community, DocTreeNode, PressConfig}

  @type action ::
          :created
          | :title_changed
          | :body_updated
          | :trashed
          | :restored
          | :archived
          | :permanently_deleted
          | :comment_created
          | :comment_updated
          | :comment_pinned
          | :comment_unpinned
          | :solution_accepted
          | :solution_replaced
          | :solution_revoked
          | :released
          | :release_rescheduled
          | :release_withdrawn
          | :draft_updated
          | :published
          | :publish_restored
          | :blocker_created
          | :blocker_released
          | :blocker_terminated
          | :setup_failed
          | :setup_retried
          | :activated
          | :destroy_scheduled
          | :destroy_cancelled
          | :destroyed
          | :lifecycle_reconciled
          | :config_updated
          | :activity_exported

  @doc """
  Appends one validated business event to its resource-specific Activity stream.

  ## Examples

      Activity.log(article, :published, actor: user)
  """
  @spec log(struct() | map(), action(), keyword()) ::
          {:ok, struct()} | {:error, ErrorCat.error()}
  def log(resource, action, opts \\ [])

  def log(_resource, action, _opts) when not is_atom(action) do
    {:error, ErrorCat.invalid_action()}
  end

  def log(%Community{} = resource, action, opts) do
    Activity.Community.log(resource, action, opts)
  end

  def log(%DocTreeNode{} = resource, action, opts) do
    Activity.DocTree.log(resource, action, opts)
  end

  def log(%PressConfig{} = resource, action, opts) do
    Activity.Press.log(resource, action, opts)
  end

  def log(%{activity_type: :community} = resource, action, opts) do
    Activity.Community.log(resource, action, opts)
  end

  def log(%{activity_type: :doc_tree} = resource, action, opts) do
    Activity.DocTree.log(resource, action, opts)
  end

  def log(%{activity_type: :press} = resource, action, opts) do
    Activity.Press.log(resource, action, opts)
  end

  def log(resource, action, opts), do: Artiment.log(resource, action, opts)

  @doc """
  Lists the safe ArticleLog surface after applying the Article read boundary.

  ## Examples

      Activity.list_article_logs(article, viewer, %{page: 1, size: 20})
  """
  @spec list_article_logs(struct(), struct() | nil, map()) :: {:ok, map()} | {:error, term()}
  def list_article_logs(article, actor, pagi \\ nil) do
    ArticleLog.list(article, actor, pagi)
  end

  @doc """
  Lists the Community management surface across Activity streams.

  ## Examples

      Activity.list_community_logs(community, viewer, %{page: 1, size: 20})
  """
  @spec list_community_logs(Community.t(), struct(), map(), pos_integer()) ::
          {:ok, map()} | {:error, term()}
  def list_community_logs(community, actor, selection, pagi \\ nil) do
    CommunityLog.list(community, actor, selection, pagi)
  end

  @doc """
  Returns UTC daily CommunityLog counts for the same filter boundary as list_community_logs/3.

  ## Examples

      Activity.get_community_log_stats(community, viewer, %{page: 1, size: 20})
  """
  @spec get_community_log_stats(Community.t(), struct(), map()) ::
          {:ok, map()} | {:error, term()}
  def get_community_log_stats(community, actor, selection) do
    CommunityLog.stats(community, actor, selection)
  end

  @doc """
  Returns active CommunityLog actions for dashboard filter controls.

  ## Examples

      Activity.get_community_log_config(community, viewer)
  """
  @spec get_community_log_config(Community.t(), struct()) :: {:ok, map()} | {:error, term()}
  def get_community_log_config(community, actor), do: CommunityLog.config(community, actor)

  @doc """
  Exports the current CommunityLog filter as a bounded JSON or CSV document.

  ## Examples

      Activity.export_community_logs(community, viewer, %{page: 1, size: 20}, :json)
  """
  @spec export_community_logs(Community.t(), struct(), map(), atom()) ::
          {:ok, map()} | {:error, term()}
  def export_community_logs(community, actor, selection, format) do
    CommunityLog.export_logs(community, actor, selection, format)
  end

  @doc """
  Reads one safe CommunityLog event with related parent and child events.

  ## Examples

      Activity.get_community_log_event(community, viewer, event_ref)
  """
  @spec get_community_log_event(Community.t(), struct(), String.t()) ::
          {:ok, map() | nil} | {:error, term()}
  def get_community_log_event(community, actor, event_ref) do
    CommunityLog.get_event_detail(community, actor, event_ref)
  end

  @doc """
  Delegates GroupherServer.Activity.Const.normalize_source/1 through the Activity Context boundary.

  ## Examples

      iex> GroupherServer.Activity.Workflow.const_normalize_source(...)
  """
  defdelegate const_normalize_source(arg1),
    to: GroupherServer.Activity.Const,
    as: :normalize_source

  @doc """
  Checks an Activity source through the Context-owned constant boundary.

      Activity -> Activity.Workflow -> Activity.Const

  ## Examples

      Activity.Workflow.const_valid_source?(:api)
  """
  defdelegate const_valid_source?(arg1),
    to: GroupherServer.Activity.Const,
    as: :valid_source?
end
