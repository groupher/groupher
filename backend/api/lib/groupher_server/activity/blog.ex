defmodule GroupherServer.Activity.Blog do
  @moduledoc """
  Owns Blog Activity actions and their safe surface projections.

      Blog command -> Blog Activity contract -> BlogLog
  """
  alias GroupherServer.Activity.Event
  alias GroupherServer.Activity.Model.BlogLog

  use GroupherServer.Activity.ArtimentEvent,
    thread: :blog,
    schema: BlogLog,
    stream_field: :blog_ref

  @trash_denial_codes [
    :permission_denied,
    :article_not_mutable,
    :ancestor_community_not_writable,
    :article_archived,
    :article_deleted,
    :article_destroyed
  ]

  @contracts %{
    created: Event.contract([], [], [:article_log, :community_log]),
    title_changed: Event.contract([:title], [:revision_ref], [:article_log, :community_log]),
    body_updated:
      Event.contract(
        [:body_hash, :schema_version, :summary],
        [:revision_ref],
        [:article_log, :community_log]
      ),
    trashed:
      Event.contract([], [], [:community_log], nil,
        outcomes: %{
          allowed: %{producer_status: :active},
          denied: %{producer_status: :active, denial_codes: @trash_denial_codes}
        }
      ),
    restored: Event.contract([], [], [:article_log, :community_log]),
    archived: Event.contract([], [:batch], [:article_log, :community_log]),
    permanently_deleted: Event.contract([], [], [:community_log]),
    comment_created: Event.contract([], [], []) |> Event.contract_only(),
    comment_updated: Event.contract([], [], []) |> Event.contract_only(),
    moderation_review_started:
      Event.contract([], [:case_ref], [:community_log]) |> Event.contract_only(),
    moderation_review_resolved:
      Event.contract([], [:case_ref, :decision], [:community_log]) |> Event.contract_only()
  }

  def contracts, do: Event.classify_contracts(@contracts)
end
