defmodule GroupherServer.Activity.Post do
  @moduledoc """
  Owns Post Activity actions and their safe surface projections.

      Post command -> Post Activity contract -> PostLog
  """
  alias GroupherServer.Activity.Event
  alias GroupherServer.Activity.Model.PostLog

  use GroupherServer.Activity.ArtimentEvent,
    thread: :post,
    schema: PostLog,
    stream_field: :post_ref

  @contracts %{
    created: Event.contract([], [], [:article_log, :community_log]),
    title_changed: Event.contract([:title], [:revision_ref], [:article_log, :community_log]),
    body_updated:
      Event.contract(
        [:body_hash, :schema_version, :summary],
        [:revision_ref],
        [:article_log, :community_log]
      ),
    trashed: Event.contract([], [], [:community_log]),
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
    solution_revoked: Event.contract([], [], [:article_log, :community_log], :comment),
    moderation_review_started:
      Event.contract([], [:case_ref], [:community_log]) |> Event.contract_only(),
    moderation_review_resolved:
      Event.contract([], [:case_ref, :decision], [:community_log]) |> Event.contract_only()
  }

  def contracts, do: Event.classify_contracts(@contracts)
end
