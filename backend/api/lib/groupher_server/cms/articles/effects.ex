defmodule GroupherServer.CMS.Articles.Effects do
  @moduledoc """
  Owns durable effect intents emitted by Article mutations.

  The caller owns the Article Command or Workflow transaction. This module
  records bounded Outbox intent; external delivery remains in the Article
  cleanup worker and its post-commit adapters.

      Article Command / Workflow
        -> Articles.Effects
        -> CMS.Outbox
        -> Article cleanup worker
  """

  alias GroupherServer.CMS
  alias CMS.Articles.Effects.{Outbox, Publish}

  @doc "Records first public selection for an admitted Article Binding."
  defdelegate published(binding, community, snapshot, operation_ref), to: Outbox
  @doc "Records a later public selection for an admitted Article Binding."
  defdelegate updated(binding, community, snapshot, operation_ref), to: Outbox
  @doc "Records first Docs publication under a sealed site Release."
  defdelegate release_published(binding, community, snapshot, release, operation_ref), to: Outbox
  @doc "Records later Docs publication under a sealed site Release."
  defdelegate release_updated(binding, community, snapshot, release, operation_ref), to: Outbox
  @doc "Records pure projection work for a selected Public head."
  defdelegate projections_selected(binding, public, first_publish?, operation_ref), to: Outbox
  @doc "Records one Binding visibility transition."
  defdelegate visibility_changed(binding, community, operation_ref), to: Outbox
  @doc "Records one Binding review transition."
  defdelegate review_changed(binding, community, operation_ref), to: Outbox
  @doc "Records a Docs removal under its sealed site Release."
  defdelegate release_removed(binding, community, release, operation_ref), to: Outbox
  @doc "Freezes first-publish notification facts in the owning publish transaction."
  defdelegate enqueue_first_publish_notification(
                article,
                community,
                snapshot,
                actor_id,
                operation_ref
              ),
              to: Outbox

  @doc "Records independent Press, Search and CDN intents for a committed Article event."
  defdelegate dispatch(event), to: Outbox

  @doc "Executes one typed Article effect after its Outbox event is claimed."
  @spec run(map()) :: {:ok, term()} | {:error, term()}
  defdelegate run(effect), to: Publish

  @doc "Records one Article activity in the caller-owned transaction."
  defdelegate activity(resource, event, opts), to: Outbox
  @doc "Loads current projection dependencies shared by recovery and delivery."
  defdelegate projection_context(event), to: CMS.Articles.Effects.Recovery
  @doc "Loads Search dependencies shared by recovery and delivery."
  defdelegate search_context(event), to: CMS.Articles.Effects.Recovery

  @doc "Derives a pure failed effect's replacement from committed publication facts."
  defdelegate recovery_status(event), to: CMS.Articles.Effects.Recovery, as: :status
end
