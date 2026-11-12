defmodule GroupherServer.CMS.Docs.Content do
  @moduledoc """
  Creates branch-free Doc identities on the shared Article content foundation.

    The admitted Docs command owns the site lock, directory, Receipt and rollback.

      Docs create command -> Content -> Article identity / default copy / Doc lifecycle
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.WorkingCopy.Store
  alias CMS.Model.{Article, ArticleBinding, Community, DocsLifecycle}

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
         {:ok, _history_owner} <-
           Repo.insert(%CMS.Model.DocsHistoryOwner{
             article_id: article.id,
             community_id: community_id
           }),
         work_attrs = Map.merge(attrs, %{scope_kind: :default, scope_id: article.id}),
         {:ok, work} <- create_copy(article, work_attrs, actor, community_id, source),
         {:ok, lifecycle} <-
           %DocsLifecycle{}
           |> DocsLifecycle.changeset(%{
             community_id: community_id,
             article_id: article.id,
             default_working_copy_id: work.id,
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
