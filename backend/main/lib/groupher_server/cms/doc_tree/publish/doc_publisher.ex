defmodule GroupherServer.CMS.DocTree.Publish.DocPublisher do
  @moduledoc """
  Publishes one docs article draft and its public tree shell.

      docs(stage=draft) + ArticleDocument
          |
          v
      CMS.Articles.publish_doc_draft
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
  alias CMS.DocTree.Events
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
         {:ok, group} <- find_publish_group(community, branch, page.group_id, page.stage),
         {:ok, tab} <- find_publish_tab(community, branch, group.tab_id, group.stage),
         {:ok, snapshot} <-
           CMS.Articles.publish_doc_draft(community, doc_id, user, branch_id: branch.id),
         {:ok, _public_tab} <- upsert_public_node(community, branch, tab),
         {:ok, public_group} <- upsert_public_node(community, branch, group),
         {:ok, public_page} <-
           upsert_public_node(
             community,
             branch,
             page,
             public_group.node_id,
             snapshot.doc_id
           ),
         {:ok, _sync} <- maybe_sync_cover(community, public_group, public_page, sync_cover?) do
      Events.mark_doc_bound_published(community, doc_id, branch_id: branch.id)

      Events.mark_tree_create_published(community, [tab.node_id, group.node_id],
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
             doc_id: draft_node.doc_id,
             stage: CMS.Const.stage(:public)
           ),
         {:ok, document} <-
           ORM.find_by(ArticleDocument, article_id: public_doc.id, thread: :doc) do
      case Draft.read(community, public_doc.doc_id, branch_id: branch.id) do
        {:ok, draft} ->
          {:ok, draft}

        {:error, _} ->
          Draft.create(
            community,
            :doc,
            %{
              branch_id: branch.id,
              doc_id: public_doc.doc_id,
              title: public_doc.title,
              slug: public_doc.slug,
              body: document.json
            },
            user
          )
      end
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

  defp find_publish_group(%Community{} = community, branch, group_id, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == ^stage)
    |> where([n], n.type == @tree_node_type_group)
    |> where([n], n.node_id == ^to_string(group_id))
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs page group does not exist"}}
    end
  end

  defp find_publish_tab(%Community{} = community, branch, tab_id, stage) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == ^stage)
    |> where([n], n.type == @tree_node_type_tab)
    |> where([n], n.node_id == ^to_string(tab_id))
    |> Repo.one()
    |> case do
      %DocTreeNode{} = node -> {:ok, node}
      nil -> {:error, {:custom, "docs page tab does not exist"}}
    end
  end

  defp upsert_public_node(
         %Community{} = community,
         branch,
         %DocTreeNode{} = draft_node,
         group_id \\ nil,
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

    attrs = public_attrs(draft_node, group_id, doc_id)

    case Map.get(public_nodes, draft_node.node_id) ||
           public_node_by_unique_attrs(community, branch, attrs) do
      %DocTreeNode{} = public_node -> ORM.update(public_node, attrs)
      nil -> ORM.create(DocTreeNode, attrs)
    end
  end

  defp public_attrs(%DocTreeNode{} = draft_node, group_id, doc_id) do
    draft_node
    |> Map.take([
      :community_id,
      :branch_id,
      :node_id,
      :type,
      :tab_id,
      :title,
      :slug,
      :index,
      :href,
      :marker,
      :badge,
      :hidden,
      :ui_config
    ])
    |> Map.merge(%{stage: CMS.Const.stage(:public), group_id: group_id, doc_id: doc_id})
  end

  defp public_node_by_unique_attrs(
         %Community{} = community,
         branch,
         %{type: @tree_node_type_group, group_id: nil} = attrs
       ) do
    public_root_group_by_slug(community, branch, Map.get(attrs, :slug)) ||
      public_root_group_by_title(community, branch, Map.get(attrs, :title))
  end

  defp public_node_by_unique_attrs(
         %Community{} = community,
         branch,
         %{group_id: group_id} = attrs
       )
       when not is_nil(group_id) do
    public_child_by_slug(community, branch, group_id, Map.get(attrs, :slug)) ||
      public_child_by_title(community, branch, group_id, Map.get(attrs, :title))
  end

  defp public_node_by_unique_attrs(_community, _branch, _attrs), do: nil

  defp public_root_group_by_slug(_community, _branch, slug) when is_nil(slug) or slug == "",
    do: nil

  defp public_root_group_by_slug(%Community{} = community, branch, slug) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.type == @tree_node_type_group)
    |> where([n], is_nil(n.group_id))
    |> where([n], n.slug == ^slug)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  defp public_root_group_by_title(_community, _branch, title) when is_nil(title) or title == "",
    do: nil

  defp public_root_group_by_title(%Community{} = community, branch, title) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.type == @tree_node_type_group)
    |> where([n], is_nil(n.group_id))
    |> where([n], n.title == ^title)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  defp public_child_by_slug(_community, _branch, _group_id, slug) when is_nil(slug) or slug == "",
    do: nil

  defp public_child_by_slug(%Community{} = community, branch, group_id, slug) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.group_id == ^group_id)
    |> where([n], n.slug == ^slug)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  defp public_child_by_title(_community, _branch, _group_id, title)
       when is_nil(title) or title == "",
       do: nil

  defp public_child_by_title(%Community{} = community, branch, group_id, title) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:public))
    |> where([n], n.group_id == ^group_id)
    |> where([n], n.title == ^title)
    |> order_by([n], desc: n.updated_at, desc: n.id)
    |> limit(1)
    |> Repo.one()
  end

  defp maybe_sync_cover(_community, _published_group, _published_page, false),
    do: {:ok, :skipped}

  defp maybe_sync_cover(
         %Community{} = community,
         %DocTreeNode{} = group,
         %DocTreeNode{} = page,
         true
       ),
       do: CMS.DocCover.Sync.sync_published_page(community, group, page)
end
