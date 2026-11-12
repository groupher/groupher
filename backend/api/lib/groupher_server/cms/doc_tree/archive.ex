defmodule GroupherServer.CMS.DocTree.Archive do
  @moduledoc """
  Archives old published Docs under the site and stable Article locks.

      maintenance -> site lock -> Article lock -> current Public / Lifecycle check -> archive

  Snapshots and public content remain intact; archived Docs stay readable.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticlePublic, Community, DocsLifecycle}
  alias CMS.DocTree.Publish.SiteLock

  @doc "Archives a bounded batch of old public Docs, rechecking each candidate under lock."
  def before(threshold) do
    candidates =
      Repo.all(
        from(l in DocsLifecycle,
          join: p in ArticlePublic,
          on: p.article_id == l.article_id,
          where: l.state == :published and p.inserted_at < ^threshold,
          order_by: [l.community_id, l.article_id],
          limit: 100,
          select: {l.community_id, l.article_id}
        )
      )

    Enum.reduce_while(candidates, {:ok, 0}, fn {site_id, article_id}, {:ok, count} ->
      case archive(site_id, article_id, threshold) do
        {:ok, archived} -> {:cont, {:ok, count + archived}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp archive(site_id, article_id, threshold) do
    Repo.transact(fn ->
      with {:ok, :acquired} <- SiteLock.acquire(%Community{id: site_id}) do
        Repo.one(from(a in Article, where: a.id == ^article_id, lock: "FOR UPDATE"))

        lifecycle =
          Repo.one(
            from(l in DocsLifecycle,
              where: l.article_id == ^article_id and l.community_id == ^site_id,
              lock: "FOR UPDATE"
            )
          )

        public = Repo.get(ArticlePublic, article_id)

        if match?(%DocsLifecycle{state: :published}, lifecycle) and
             match?(%ArticlePublic{}, public) and
             DateTime.compare(public.inserted_at, threshold) == :lt do
          now = DateTime.utc_now(:second)

          with {:ok, updated} <-
                 lifecycle
                 |> DocsLifecycle.changeset(%{
                   state: :archived,
                   archived_at: now,
                   changed_at: now,
                   version: lifecycle.version + 1
                 })
                 |> Repo.update(),
               {:ok, :pass} <- CMS.ReviewBlocks.recompute(updated),
               {:ok, :pass} <- CMS.ArtimentMentions.MentionsGraph.Revision.bump() do
            {:ok, 1}
          end
        else
          {:ok, 0}
        end
      end
    end)
  end
end
