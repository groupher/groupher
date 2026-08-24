defmodule GroupherServer.Activity.Changelog do
  @moduledoc """
  Owns Changelog Activity actions and their safe surface projections.

      Changelog command -> Changelog Activity contract -> ChangelogLog
  """
  alias GroupherServer.Activity.Event
  alias GroupherServer.Activity.Model.ChangelogLog

  use GroupherServer.Activity.ArtimentEvent,
    thread: :changelog,
    schema: ChangelogLog,
    stream_field: :changelog_ref

  @contracts %{
    created: Event.contract([], [], [:article_log, :community_log]),
    title_changed: Event.contract([:title], [:revision_ref], [:article_log, :community_log]),
    body_updated:
      Event.contract(
        [:body_hash, :schema_version, :summary],
        [:revision_ref],
        [:article_log, :community_log]
      ),
    released: Event.contract([:released_at], [], [:article_log, :community_log]),
    release_rescheduled:
      Event.contract([:released_at], [], [:article_log, :community_log])
      |> Event.contract_only(),
    release_withdrawn:
      Event.contract([], [], [:article_log, :community_log]) |> Event.contract_only(),
    trashed: Event.contract([], [], [:community_log]),
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
