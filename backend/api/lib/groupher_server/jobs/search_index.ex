defmodule GroupherServer.Jobs.SearchIndex do
  @moduledoc """
  Search Artiments indexing job.

  Business position:

      Domain event / scheduler
        -> Oban
        -> SearchIndex
        -> context / service
  """

  alias GroupherServer.Jobs.Config

  use Oban.Worker,
    queue: Config.queue(:search_index),
    max_attempts: Config.max_attempts(:search_index),
    unique: Config.unique(:search_index)

  alias GroupherServer.CMS.SearchArtiments.Indexer

  @impl Oban.Worker
  def perform(%Oban.Job{
        args: %{"action" => "upsert_article", "thread" => thread, "ref" => article_id}
      }) do
    Indexer.upsert_article(String.to_existing_atom(thread), article_id)
  end

  def perform(%Oban.Job{
        args: %{"action" => "sync_article_metrics", "thread" => thread, "ref" => article_id}
      }) do
    Indexer.sync_article_metrics(String.to_existing_atom(thread), article_id)
  end

  def perform(%Oban.Job{
        args: %{"action" => "delete_article", "thread" => thread, "ref" => article_hash_id}
      }) do
    Indexer.delete_article(String.to_existing_atom(thread), article_hash_id)
  end
end
