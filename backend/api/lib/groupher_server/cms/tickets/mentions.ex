defmodule GroupherServer.CMS.Tickets.Mentions do
  @moduledoc """
  Captures a published Ticket body inside its owning Command transaction.

      Ticket publish -> selected public body -> current Mention edges
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Artiment.PlateJSON
  alias CMS.ArtimentMentions
  alias CMS.Model.{Article, ArticleBodySnapshot, ArticlePublic, ArticleRevision, Community}

  def update(article_id, %Community{} = community, command_id) when is_binary(command_id) do
    with {:ok, %Article{thread: :ticket} = article} <-
           CMS.FrontDesk.article(article_id, mode: :internal),
         %ArticlePublic{} = public <- Repo.get(ArticlePublic, article.id),
         %ArticleRevision{} = revision <- Repo.get(ArticleRevision, public.revision_id),
         %ArticleBodySnapshot{} = body <- Repo.get(ArticleBodySnapshot, revision.body_snapshot_id),
         {:ok, ast} <- PlateJSON.decode(body.json),
         true <- match?(%DateTime{}, public.updated_at) do
      ArtimentMentions.update(
        %{type: :ticket, article_id: article.id},
        %{
          published_revision_identity: "#{public.revision_id}:#{public.publication_version}",
          ast: ast,
          community_id: community.id,
          mentioned_at: public.updated_at
        },
        {:command, command_id}
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
