defmodule GroupherServer.CMS.SearchArtiments.QueueAdapter do
  @moduledoc """
  Contract for persistent Search Artiments indexing queues.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> QueueAdapter
        -> search platform
  """

  @type action :: :upsert_article | :sync_article_metrics | :delete_article
  @type job :: {action(), atom(), term()}

  @callback enqueue(job()) :: {:ok, :pass}
end
