defmodule GroupherServer.CMS.Tickets.Mentions do
  @moduledoc """
  Captures a published Ticket body inside its owning Command transaction.

      Ticket publish -> selected public body -> current Mention edges
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.PlateJSON
  alias CMS.ArtimentMentions
  alias CMS.Model.{Article, ArticlePublic, ArticleSnapshot, Community}

  def update(article_id, %Community{} = community, operation_ref) when is_binary(operation_ref) do
    with {:ok, %Article{thread: :ticket} = article} <-
           CMS.FrontDesk.article(article_id, mode: :internal),
         %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleSnapshot{} = snapshot <- Repo.get(ArticleSnapshot, public.snapshot_id),
         {:ok, ast} <- PlateJSON.decode(CMS.Articles.Body.document(snapshot).json),
         true <- match?(%DateTime{}, public.updated_at) do
      ArtimentMentions.update(
        %{type: :ticket, article_id: article.id},
        %{
          published_revision_identity: "article-snapshot:#{snapshot.id}:#{public.published_at}",
          ast: ast,
          community_id: community.id,
          mentioned_at: public.updated_at
        },
        operation_ref
      )
    else
      false -> {:error, :ticket_publication_time_missing}
      nil -> {:error, :ticket_publication_missing}
      {:error, _reason} = error -> error
      _ -> {:error, :ticket_publication_missing}
    end
  end

  def update(_, _, _), do: {:error, :ticket_publication_missing}
end
