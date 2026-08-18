defmodule GroupherServer.CMS.Gate.Access.Loader.Article do
  @moduledoc """
  Loads ordinary Article or branch-scoped Doc facts.

  The selected thread determines which Lifecycle authority is locked. Ordinary
  Articles produce `Access.Article`; Docs produce `Access.Doc`.

      Article/Doc resource -> Article Loader -> typed Context -> Access policy

  The public-in-Elixir `load/3` function is an internal Gate seam; its stable
  consumer is `Access.Check.Article`.
  """

  alias GroupherServer.CMS.Gate.Access.Loader.Queries
  alias GroupherServer.CMS.Gate.Context.Access.{Article, Doc}

  alias GroupherServer.CMS.Model.{
    ArticleLifecycle,
    Community,
    CommunityLifecycle,
    DocBranch,
    DocLifecycle
  }

  @doc false
  def load(
        %Community{} = community,
        :doc,
        %{community_id: community_id, branch_id: branch_id, article_hash_id: hash_id} = resource
      )
      when community_id == community.id and not is_nil(branch_id) do
    with %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %DocBranch{} = doc_branch <- Queries.doc_branch(community.id, branch_id),
         %DocLifecycle{} = doc_lifecycle <-
           Queries.doc_lifecycle(community.id, branch_id, hash_id) do
      {:ok,
       %Doc{
         doc: resource,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         doc_branch: doc_branch,
         doc_lifecycle: doc_lifecycle
       }}
    else
      nil -> {:error, :lifecycle_not_found}
    end
  end

  def load(%Community{} = community, :doc, %{community_id: community_id})
      when community_id == community.id,
      do: {:error, :doc_branch_required}

  def load(
        %Community{} = community,
        thread,
        %{community_id: community_id, article_hash_id: hash_id} = resource
      )
      when thread in [:post, :blog, :changelog] and community_id == community.id do
    with %CommunityLifecycle{} = community_lifecycle <- Queries.community_lifecycle(community.id),
         %ArticleLifecycle{} = article_lifecycle <-
           Queries.article_lifecycle(community.id, thread, hash_id) do
      {:ok,
       %Article{
         article: resource,
         community: %{community | lifecycle: community_lifecycle},
         community_lifecycle: community_lifecycle,
         article_lifecycle: article_lifecycle
       }}
    else
      nil -> {:error, :lifecycle_not_found}
    end
  end

  def load(_community, _thread, _resource), do: {:error, :gate_resource_mismatch}
end
