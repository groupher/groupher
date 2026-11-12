defmodule GroupherServer.Activity.Doc do
  @moduledoc """
  Owns stable Article Doc Activity actions and projections.

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
    title_changed: Event.contract([:title], [:snapshot_id], [:article_log, :community_log]),
    body_updated:
      Event.contract(
        [:schema_version, :summary],
        [:snapshot_id],
        [:article_log, :community_log]
      ),
    published: Event.contract([], [:snapshot_id], [:article_log, :community_log]),
    trashed: Event.contract([], [], [:community_log]),
    restored: Event.contract([], [], [:article_log, :community_log]),
    archived: Event.contract([], [:batch], [:article_log, :community_log]),
    permanently_deleted: Event.contract([], [], [:community_log]),
    comment_created: Event.contract([], [], []) |> Event.contract_only(),
    comment_updated: Event.contract([], [], []) |> Event.contract_only()
  }

  @doc """
  Returns Doc's classified Activity contracts.

  ## Examples

      Activity.Doc.contracts()[:published].classification
  """
  def contracts, do: Event.classify_contracts(@contracts)
end
