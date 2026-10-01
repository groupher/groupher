defmodule GroupherServer.Activity.Doc do
  @moduledoc """
  Owns branch-aware Doc Activity actions and projections.

      Doc command -> Doc Activity contract -> DocLog
  """

  use GroupherServer.Activity.ArtimentEvent,
    thread: :doc,
    schema: GroupherServer.Activity.Model.DocLog,
    stream_field: :article_id

  alias GroupherServer.Activity
  alias Activity.Event

  @contracts %{
    created: Event.contract([], [], [:article_log, :community_log]),
    title_changed: Event.contract([:title], [:revision_id], [:article_log, :community_log]),
    body_updated:
      Event.contract(
        [:body_hash, :schema_version, :summary],
        [:revision_id],
        [:article_log, :community_log]
      ),
    draft_updated:
      Event.contract([:body_hash, :schema_version], [:revision_id], [])
      |> Event.contract_only(),
    published:
      Event.contract([], [:revision_id, :branch_version_id], [:article_log, :community_log]),
    publish_restored:
      Event.contract([], [:revision_id, :branch_version_id], [:article_log, :community_log]),
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
