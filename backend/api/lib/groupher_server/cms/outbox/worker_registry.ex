defmodule GroupherServer.CMS.Outbox.WorkerRegistry do
  @moduledoc """
  Maps persisted CMS Outbox worker names to the finite set of supported workers.

  Outbox events retain their delivery route so a consistency check can restore
  a missing Oban wakeup without guessing from event payloads or creating atoms
  from database values.

      persisted event.worker -> WorkerRegistry -> allowlisted worker -> Oban wakeup
  """

  @workers [
    GroupherServer.Jobs.CMSArtimentReview,
    GroupherServer.Jobs.CMSMentionNotifier,
    GroupherServer.Jobs.CMSOutboxAdminRequest,
    GroupherServer.Jobs.CMSOutboxArticle,
    GroupherServer.Jobs.CMSOutboxArticleCoAuthor,
    GroupherServer.Jobs.CMSOutboxAsset,
    GroupherServer.Jobs.CMSOutboxCDN,
    GroupherServer.Jobs.CMSOutboxComment,
    GroupherServer.Jobs.CMSOutboxCommunity,
    GroupherServer.Jobs.CMSOutboxDocs,
    GroupherServer.Jobs.CMSOutboxInteraction,
    GroupherServer.Jobs.CMSOutboxPress,
    GroupherServer.Jobs.CMSOutboxSearch,
    GroupherServer.Jobs.CMSOutboxTicket
  ]

  @worker_names Map.new(@workers, &{&1, inspect(&1)})
  @workers_by_name Map.new(@workers, &{inspect(&1), &1})

  @doc "Rejects a persisted route that does not belong to the concrete event contract."
  def validate_route(%{event: event, worker: worker}) do
    valid? =
      case {event, worker} do
        {kind, "GroupherServer.Jobs.CMSOutboxArticle"}
        when kind in [
               "article.published",
               "article.updated",
               "article.projections",
               "article.first_published_notification",
               "article.visibility_changed",
               "article.review_changed"
             ] ->
          true

        {"article.search_sync", "GroupherServer.Jobs.CMSOutboxSearch"} ->
          true

        {"article.cdn_purge", "GroupherServer.Jobs.CMSOutboxCDN"} ->
          true

        {kind, "GroupherServer.Jobs.CMSOutboxAsset"}
        when kind in [
               "asset.provider_delete",
               "asset.application_upload_provider_delete"
             ] ->
          true

        {kind, "GroupherServer.Jobs.CMSOutboxComment"}
        when kind in [
               "comment.changed",
               "comment.created",
               "comment.replied",
               "comment.updated",
               "comment.deleted"
             ] ->
          true

        {kind, "GroupherServer.Jobs.CMSOutboxCommunity"}
        when kind in [
               "community.analysis_provision",
               "community.presentation_changed",
               "community.taxonomy_changed",
               "community.pagi_mode_changed",
               "doc_tree.changed"
             ] ->
          true

        {"community.admin_request", "GroupherServer.Jobs.CMSOutboxAdminRequest"} ->
          true

        {"article.co_author_request", "GroupherServer.Jobs.CMSOutboxArticleCoAuthor"} ->
          true

        {"docs.approval_status", "GroupherServer.Jobs.CMSOutboxDocs"} ->
          true

        {"mention.notify", "GroupherServer.Jobs.CMSMentionNotifier"} ->
          true

        {"cms.artiment_review", "GroupherServer.Jobs.CMSArtimentReview"} ->
          true

        {"press.cache_invalidation", "GroupherServer.Jobs.CMSOutboxPress"} ->
          true

        {kind, "GroupherServer.Jobs.CMSOutboxTicket"}
        when kind in [
               "ticket.notification",
               "ticket.cache_invalidation"
             ] ->
          true

        {kind, "GroupherServer.Jobs.CMSOutboxInteraction"}
        when kind in [
               "interaction.upvote_changed",
               "interaction.collect_changed",
               "interaction.emotion_changed"
             ] ->
          true

        _ ->
          false
      end

    if valid?, do: {:ok, :pass}, else: {:error, :outbox_worker_invalid}
  end

  @doc "Returns the durable Oban worker name for a registered module."
  @spec name_for(module()) :: {:ok, String.t()} | :error
  def name_for(worker) when is_atom(worker), do: Map.fetch(@worker_names, worker)
  def name_for(_worker), do: :error

  @doc "Resolves a persisted worker name without creating atoms."
  @spec worker_for(String.t()) :: {:ok, module()} | :error
  def worker_for(name) when is_binary(name), do: Map.fetch(@workers_by_name, name)
  def worker_for(_name), do: :error
end
