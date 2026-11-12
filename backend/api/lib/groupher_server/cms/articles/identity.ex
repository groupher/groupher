defmodule GroupherServer.CMS.Articles.Identity do
  @moduledoc """
  Creates an ordinary Article identity and its runtime admission rows.

      admitted create command -> Article / Binding / Lifecycle / typed state

  The caller owns the transaction and creates the WorkingCopy afterwards.
  Docs identity and Lifecycle creation belong to Docs.Content.
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Article, ArticleBinding, ArticleLifecycle, Author, Community, PostState}

  @doc "Creates identity rows inside the caller's transaction."
  def create_loaded(%Community{} = community, thread, attrs, %Author{} = author)
      when thread in [:post, :blog, :changelog, :ticket] do
    with true <- Repo.in_transaction?(),
         {:ok, article} <-
           %Article{id: value(attrs, :article_id)}
           |> Article.changeset(%{thread: thread, author_id: author.id})
           |> Repo.insert(),
         {:ok, _binding} <-
           %ArticleBinding{}
           |> ArticleBinding.changeset(%{article_id: article.id, community_id: community.id})
           |> Repo.insert(),
         {:ok, _lifecycle} <-
           %ArticleLifecycle{}
           |> ArticleLifecycle.changeset(%{
             article_id: article.id,
             thread: thread,
             state: :draft,
             version: 1,
             changed_at: DateTime.utc_now(:second)
           })
           |> Repo.insert(),
         {:ok, _state} <- insert_post_state(article, attrs) do
      {:ok, article}
    else
      false -> {:error, :transaction_required}
      {:error, _} = error -> error
    end
  end

  defp insert_post_state(%Article{thread: :post, id: article_id}, attrs) do
    %PostState{}
    |> PostState.changeset(%{article_id: article_id, cat: value(attrs, :cat)})
    |> Repo.insert()
  end

  defp insert_post_state(%Article{}, _attrs), do: {:ok, :not_applicable}
  defp value(attrs, key), do: Map.get(attrs, key) || Map.get(attrs, Atom.to_string(key))
end
