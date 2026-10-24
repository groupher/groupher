defmodule GroupherServer.Activity.Post do
  @moduledoc """
  Owns Post Activity actions and their safe surface projections.

      Post command -> Post Activity contract -> PostLog
  """

  use GroupherServer.Activity.ArtimentEvent,
    thread: :post,
    schema: GroupherServer.Activity.Model.PostLog,
    stream_field: :article_id

  alias GroupherServer.Activity
  alias Activity.Event

  @trash_rejection_codes [
    :permission_denied,
    :article_not_mutable,
    :ancestor_community_not_writable,
    :article_archived,
    :article_deleted,
    :article_destroyed
  ]

  @contracts %{
    created: Event.contract([], [], [:article_log, :community_log]),
    title_changed: Event.contract([:title], [:revision_id], [:article_log, :community_log]),
    body_updated:
      Event.contract(
        [:body_hash, :schema_version, :summary],
        [:revision_id],
        [:article_log, :community_log]
      ),
    trashed:
      Event.contract([], [], [:community_log], nil,
        outcomes: %{
          allowed: %{producer_status: :active},
          denied: %{producer_status: :active, rejection_codes: @trash_rejection_codes}
        }
      ),
    restored: Event.contract([], [], [:article_log, :community_log]),
    archived: Event.contract([], [:batch], [:article_log, :community_log]),
    permanently_deleted: Event.contract([], [], [:community_log]),
    comment_created: Event.contract([], [], []) |> Event.contract_only(),
    comment_updated: Event.contract([], [], []) |> Event.contract_only(),
    comment_pinned: Event.contract([], [], [:article_log, :community_log]),
    comment_unpinned: Event.contract([], [], [:article_log, :community_log]),
    solution_accepted: Event.contract([], [], [:article_log, :community_log], :comment),
    solution_replaced:
      Event.contract([:previous_comment_ref], [], [:article_log, :community_log], :comment),
    solution_revoked: Event.contract([], [], [:article_log, :community_log], :comment)
  }

  @doc """
  Returns Post's classified Activity contracts.

  ## Examples

      Activity.Post.contracts()[:created].classification
  """
  def contracts, do: Event.classify_contracts(@contracts)
end
