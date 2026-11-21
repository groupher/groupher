defmodule GroupherServer.CMS.Docs.Content do
  @moduledoc """
  Creates branch-free Doc identities on the shared Article content foundation.

    The admitted Docs command owns the site lock, directory, Receipt and rollback.

      Docs create command -> Content -> Article identity / default copy / shared ArticleLifecycle
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.Store
  alias CMS.Model.{Article, ArticleBinding, ArticleLifecycle, Community}

  @doc "Creates the Article, binding, default WorkingCopy and Lifecycle in the caller transaction."
  def create_workspace(community, attrs, actor, source \\ nil)

  def create_workspace(%Community{id: community_id}, attrs, %User{} = actor, source)
      when is_integer(community_id) and is_map(attrs) do
    with true <- Repo.in_transaction?(),
         {:ok, article_id} <- Ecto.UUID.cast(Map.get(attrs, :article_id, Ecto.UUID.generate())),
         {:ok, author} <- CMS.Articles.Persist.ensure_author_exists(actor),
         {:ok, article} <-
           %Article{id: article_id}
           |> Article.changeset(%{thread: :doc, author_id: author.id})
           |> Repo.insert(),
         {:ok, _binding} <-
           %ArticleBinding{}
           |> ArticleBinding.changeset(%{article_id: article.id, community_id: community_id})
           |> Repo.insert(),
         work_attrs = Map.merge(attrs, %{scope_type: :default, scope_id: article.id}),
         {:ok, work} <- create_copy(article, work_attrs, actor, community_id, source),
         {:ok, lifecycle} <-
           %ArticleLifecycle{}
           |> ArticleLifecycle.changeset(%{
             article_id: article.id,
             thread: :doc,
             state: :draft,
             version: 1,
             changed_at: DateTime.utc_now(:second)
           })
           |> Repo.insert() do
      {:ok, %{article: article, working_copy: work, lifecycle: lifecycle}}
    else
      :error -> {:error, :invalid_doc_identity}
      false -> {:error, :transaction_required}
      {:error, _reason} = error -> error
    end
  end

  def create_workspace(_, _, _, _), do: {:error, :invalid_doc_workspace}

  defp create_copy(article, attrs, actor, community_id, nil) do
    Store.create_loaded(article, attrs, actor, community_id)
  end

  defp create_copy(article, attrs, actor, community_id, {source, cover_refs}) do
    Store.duplicate_doc_loaded(article, source, attrs, actor, community_id, cover_refs)
  end
end
