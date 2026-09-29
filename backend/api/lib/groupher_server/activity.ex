defmodule GroupherServer.Activity do
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
          | :moderation_review_started
          | :moderation_review_resolved
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

  @doc "Appends one validated business event to its resource-specific Activity stream."
  @spec log(struct() | map(), action(), keyword()) ::
          {:ok, struct()} | {:error, ErrorCat.error()}
  def log(resource, action, opts \\ [])

  def log(_resource, action, _opts) when not is_atom(action),
    do: {:error, ErrorCat.invalid_action()}

  def log(%Community{} = resource, action, opts),
    do: __MODULE__.Community.log(resource, action, opts)

  def log(%DocTreeNode{} = resource, action, opts),
    do: __MODULE__.DocTree.log(resource, action, opts)

  def log(%PressConfig{} = resource, action, opts),
    do: __MODULE__.Press.log(resource, action, opts)

  def log(%{activity_type: :community} = resource, action, opts),
    do: __MODULE__.Community.log(resource, action, opts)

  def log(%{activity_type: :doc_tree} = resource, action, opts),
    do: __MODULE__.DocTree.log(resource, action, opts)

  def log(%{activity_type: :press} = resource, action, opts),
    do: __MODULE__.Press.log(resource, action, opts)

  def log(resource, action, opts), do: Artiment.log(resource, action, opts)

  @doc "Lists the safe ArticleLog surface after applying the Article read boundary."
  @spec list_article_logs(struct(), struct() | nil, map()) :: {:ok, map()} | {:error, term()}
  def list_article_logs(article, actor, filter \\ %{}),
    do: ArticleLog.list(article, actor, filter)

  @doc "Lists the Community management surface across Activity streams."
  @spec list_community_logs(Community.t(), struct(), map(), pos_integer()) ::
          {:ok, map()} | {:error, term()}
  def list_community_logs(community, actor, selection, page \\ 1),
    do: CommunityLog.list(community, actor, selection, page)

  @doc "Returns UTC daily CommunityLog counts for the same filter boundary as list_community_logs/3."
  @spec get_community_log_stats(Community.t(), struct(), map()) ::
          {:ok, map()} | {:error, term()}
  def get_community_log_stats(community, actor, selection),
    do: CommunityLog.stats(community, actor, selection)

  @doc "Returns active CommunityLog actions for dashboard filter controls."
  @spec get_community_log_config(Community.t(), struct()) :: {:ok, map()} | {:error, term()}
  def get_community_log_config(community, actor), do: CommunityLog.config(community, actor)

  @doc "Exports the current CommunityLog filter as a bounded JSON or CSV document."
  @spec export_community_logs(Community.t(), struct(), map(), atom()) ::
          {:ok, map()} | {:error, term()}
  def export_community_logs(community, actor, selection, format),
    do: CommunityLog.export_logs(community, actor, selection, format)

  @doc "Reads one safe CommunityLog event with related parent and child events."
  @spec get_community_log_event(Community.t(), struct(), String.t()) ::
          {:ok, map() | nil} | {:error, term()}
  def get_community_log_event(community, actor, event_ref),
    do: CommunityLog.get_event_detail(community, actor, event_ref)
end
