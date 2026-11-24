defmodule GroupherServer.Jobs.SearchIndex do
  @moduledoc """
  Dispatches the closed set of Article search-index maintenance actions to the
  CMS search indexer. Payload values are converted only from existing atoms,
  preventing a persisted job from creating arbitrary runtime atoms.

  Business position:

      Article write / metrics change
        -> Oban
        -> SearchIndex action + thread + article id
        -> CMS.SearchArtiments.Indexer
        -> external search index state
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:search_index),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:search_index),
    unique: GroupherServer.Jobs.Config.unique(:search_index)

  @doc """
  Runs one closed-vocabulary Article search-index action from an Oban payload.

  ## Examples

      perform(%Oban.Job{args: %{
        "action" => "upsert_article",
        "thread" => "post",
        "ref" => Ecto.UUID.generate()
      }})
  """
  @impl Oban.Worker
  def perform(%Oban.Job{
        args: %{"action" => "upsert_article", "thread" => thread, "ref" => article_id}
      }) do
    GroupherServer.CMS.search_artiments_indexer_upsert_article(
      String.to_existing_atom(thread),
      article_id
    )
  end

  def perform(%Oban.Job{
        args: %{"action" => "sync_article_metrics", "thread" => thread, "ref" => article_id}
      }) do
    GroupherServer.CMS.search_artiments_indexer_sync_article_metrics(
      String.to_existing_atom(thread),
      article_id
    )
  end

  def perform(%Oban.Job{
        args: %{"action" => "delete_article", "thread" => thread, "ref" => article_id}
      }) do
    GroupherServer.CMS.search_artiments_indexer_delete_article(
      String.to_existing_atom(thread),
      article_id
    )
  end
end
