defmodule GroupherServer.CMS.DocTree.Publish.DocPublisher do
  @moduledoc """
  Publishes one docs article draft and its public tree shell.

      docs(stage=draft) + ArticleDocument
          |
          v
          CMS.Docs.publish_draft
          |
          +--> docs(stage=public) / article snapshot
          +--> parent group public row
          +--> page public row
          +--> optional doc cover sync
          |
          v
      doc-bound staged tree events marked published

  This module owns article-content publish work. Tree-only staged events are
  projected by `PublicProjection`, and release history is recorded by `Release`.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Articles.Lock
  alias CMS.DocTree.Events
  alias CMS.Gate.Decision
  alias CMS.Model.{ArticleDocument, Community, Doc, DocTreeNode}
  alias Helper.{ORM, T}

  require CMS.Const

  @tree_node_type_tab CMS.Const.tree_node_type(:tab)
  @tree_node_type_group CMS.Const.tree_node_type(:group)
  @tree_node_type_page CMS.Const.tree_node_type(:page)

  def publish_doc_draft(
        %Community{} = community,
        branch,
        %{doc_id: doc_id, page_node_id: page_node_id},
        %User{} = user,
        sync_cover?
      ) do
    with {:ok, page} <- find_publish_page(community, branch, doc_id, page_node_id),
         {:ok, ancestors} <- ancestor_chain(community, branch, page),
         {:ok, snapshot} <-
          CMS.Docs.publish_draft(community, doc_id, user, branch_id: branch.id),
         {:ok, public_ancestors} <- upsert_public_ancestors(community, branch, ancestors),
         {:ok, public_page} <-
           upsert_public_node(community, branch, page, snapshot.article_hash_id),
         {:ok, _sync} <-
           maybe_sync_cover(
             community,
             List.last(public_ancestors),
             public_page,
             sync_cover?
           ) do
      Events.mark_doc_bound_published(community, doc_id, branch_id: branch.id)

      Events.mark_tree_create_published(community, Enum.map(ancestors, & &1.node_id),
        branch_id: branch.id
      )

      {:ok, snapshot}
    end
  end

  @spec move_doc_to_draft(Community.t(), term(), T.id(), User.t()) :: T.domain_res(Doc.t())
  def move_doc_to_draft(%Community{} = community, branch, node_id, %User{} = user) do
    alias CMS.Articles.Draft

    with {:ok, draft_node} <- find_draft_node(community, branch, node_id),
         {:ok, public_doc} <-
           ORM.find_by(Doc,
             community_id: community.id,
             branch_id: branch.id,
             article_hash_id: draft_node.doc_id,
             stage: CMS.Const.stage(:public)
           ),
         {:ok, document} <-
           ORM.find_by(ArticleDocument, article_id: public_doc.id, thread: :doc) do
      Lock.run_doc(community, branch.id, public_doc.article_hash_id, fn ->
        with {:ok, _canonical_doc} <- CMS.Gate.access_check(user, :edit, public_doc) do
          case Draft.read(community, :doc, public_doc.article_hash_id, branch_id: branch.id) do
            {:ok, draft} ->
              {:ok, draft}

            {:error, _} ->
              Draft.create(
                community,
                :doc,
                %{
                  branch_id: branch.id,
                  article_hash_id: public_doc.article_hash_id,
                  title: public_doc.title,
                  slug: public_doc.slug,
                  body_bag: BodyBag.from_document_map(document)
                },
                user
              )
          end
        else
          {:error, %Decision{} = decision} -> {:error, Decision.primary_code(decision)}
        end
      end)
    end
  end

  @spec public_node_for_draft(Community.t(), term(), T.id()) :: T.domain_res(DocTreeNode.t())
  def public_node_for_draft(%Community{} = community, branch, node_id) do
    ORM.find_by(DocTreeNode,
      community_id: community.id,
      branch_id: branch.id,
      stage: CMS.Const.stage(:public),
      node_id: to_string(node_id)
    )
  end

  defp find_draft_node(%Community{} = community, branch, node_id) do
    node_id = to_string(node_id)

    DocTreeNode
    |> where(
      [node],
      node.community_id == ^community.id and node.branch_id == ^branch.id and
        node.stage == CMS.Const.stage(:draft) and
        (node.node_id == ^node_id or fragment("?::text", node.id) == ^node_id)
    )
    |> limit(1)
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      nil -> {:error, {:custom, "Doc tree node(draft) not found"}}
    end
  end

  defp find_publish_page(%Community{} = community, branch, doc_id, page_node_id) do
    page =
      find_page_by_node_id(community, branch, page_node_id, CMS.Const.stage(:public)) ||
        find_page_by_node_id(community, branch, page_node_id, CMS.Const.stage(:draft)) ||
        find_page_by_doc_id(community, branch, doc_id, CMS.Const.stage(:public)) ||
        find_page_by_doc_id(community, branch, doc_id, CMS.Const.stage(:draft))

    case page do
      %DocTreeNode{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs page has not been added to the side tree"}}
    end
  end

  defp find_page_by_node_id(_community, _branch, nil, _stage), do: nil

  defp find_page_by_node_id(%Community{} = community, branch, node_id, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == ^stage)
    |> where([n], n.type == @tree_node_type_page)
    |> where([n], n.node_id == ^to_string(node_id))
    |> Repo.one()
  end

  defp find_page_by_doc_id(%Community{} = community, branch, doc_id, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == ^stage)
    |> where([n], n.type == @tree_node_type_page)
    |> where([n], n.doc_id == ^doc_id)
    |> Repo.one()
  end

  defp ancestor_chain(%Community{} = community, branch, %DocTreeNode{} = page) do
    nodes =
      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.stage == ^page.stage)
      |> where([n], n.type in [@tree_node_type_tab, @tree_node_type_group])
      |> Repo.all()
      |> Map.new(&{&1.node_id, &1})

    collect_ancestors(nodes, page.parent_node_id, [], MapSet.new())
  end

  defp collect_ancestors(_nodes, nil, ancestors, _seen),
    do: {:ok, ancestors}

  defp collect_ancestors(nodes, node_id, ancestors, seen) do
    cond do
      MapSet.member?(seen, node_id) ->
        {:error, {:custom, "docs navigation contains a cycle"}}

      parent = Map.get(nodes, node_id) ->
        collect_ancestors(
          nodes,
          parent.parent_node_id,
          [parent | ancestors],
          MapSet.put(seen, node_id)
        )

      true ->
        {:error, {:custom, "docs page ancestor does not exist"}}
    end
  end

  defp upsert_public_ancestors(community, branch, ancestors) do
    Enum.reduce_while(ancestors, {:ok, []}, fn ancestor, {:ok, published} ->
      case upsert_public_node(community, branch, ancestor) do
        {:ok, node} -> {:cont, {:ok, published ++ [node]}}
        error -> {:halt, error}
      end
    end)
  end

  defp upsert_public_node(
         %Community{} = community,
         branch,
         %DocTreeNode{} = draft_node,
         doc_id \\ nil,
         public_nodes \\ nil
       ) do
    public_nodes =
      public_nodes ||
        DocTreeNode
        |> where([n], n.community_id == ^community.id)
        |> where([n], n.branch_id == ^branch.id)
        |> where([n], n.stage == CMS.Const.stage(:public))
        |> where([n], n.node_id == ^draft_node.node_id)
        |> Repo.all()
        |> Map.new(&{&1.node_id, &1})

    attrs = public_attrs(draft_node, doc_id)

    case Map.get(public_nodes, draft_node.node_id) do
      %DocTreeNode{} = public_node -> ORM.update(public_node, attrs)
      nil -> ORM.create(DocTreeNode, attrs)
    end
  end

  defp public_attrs(%DocTreeNode{} = draft_node, doc_id) do
    draft_node
    |> Map.take([
      :community_id,
      :branch_id,
      :node_id,
      :type,
      :parent_node_id,
      :title,
      :index,
      :href,
      :marker,
      :badge,
      :hidden
    ])
    |> Map.merge(%{
      stage: CMS.Const.stage(:public),
      doc_id: doc_id || draft_node.doc_id
    })
  end

  defp maybe_sync_cover(_community, _published_group, _published_page, false),
    do: {:ok, :skipped}

  defp maybe_sync_cover(_community, nil, _published_page, true),
    do: {:ok, :skipped}

  defp maybe_sync_cover(
         %Community{} = community,
         %DocTreeNode{} = group,
         %DocTreeNode{} = page,
         true
       ),
       do: CMS.DocCover.Sync.sync_published_page(community, group, page)
end
