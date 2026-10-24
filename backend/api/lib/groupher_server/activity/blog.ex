defmodule GroupherServer.Activity.Blog do
  @moduledoc """
  Owns Blog Activity actions and their safe surface projections.

      Blog command -> Blog Activity contract -> BlogLog
  """

  use GroupherServer.Activity.ArtimentEvent,
    thread: :blog,
    schema: GroupherServer.Activity.Model.BlogLog,
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
    comment_updated: Event.contract([], [], []) |> Event.contract_only()
  }

  @doc """
  Returns Blog's classified Activity contracts.

  ## Examples

      Activity.Blog.contracts()[:created].classification
  """
  def contracts, do: Event.classify_contracts(@contracts)
end
