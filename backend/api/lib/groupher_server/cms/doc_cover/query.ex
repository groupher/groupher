defmodule GroupherServer.CMS.DocCover.Query do
  @moduledoc """
  Read projection for the public docs cover.

  A persisted Cover row selects one published Group. Card items are derived
  from that Group's direct public navigation entries:

      Page  -> page item
      Link  -> link item
      Group -> group item with recursive leaf_count and first-leaf href

  Nested descendants are never flattened into the parent Card.
  """

  require GroupherServer.CMS.Const
  require GroupherServer.CMS.DocCover.Const

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User

  alias CMS.Model.{
    Article,
    ArticleBinding,
    Community,
    DocCoverCard,
    DocCoverPinnedDoc,
    ArticlePublic,
    ArticlePublicBody,
    DocsTreeNode
  }

  alias Helper.T

  @type view :: :public | :dashboard

  @doc "Allowed cover read views."
  def view_values, do: CMS.DocCover.Const.cover_view_enum_values()

  @doc "Reads Group Cards and pinned docs for one community."
  @spec read(Community.t(), view(), User.t() | nil) :: T.domain_res(map())
  def read(%Community{} = community, view \\ CMS.DocCover.Const.cover_view(:public), actor \\ nil)
      when view in CMS.DocCover.Const.cover_view_values() do
    with {:ok, _} <- authorize_view(community, view, actor) do
      do_read(community, view)
    end
  end

  defp do_read(%Community{} = community, view) do
    cards =
      DocCoverCard
      |> where([card], card.community_id == ^community.id)
      |> order_by([card], asc: card.index, asc: card.id)
      |> preload(:group_node)
      |> Repo.all()
      |> Enum.filter(&match?(%{group_node: %DocsTreeNode{type: :group}}, &1))

    pinned_docs =
      DocCoverPinnedDoc
      |> where([pin], pin.community_id == ^community.id)
      |> order_by([pin], asc: pin.index, asc: pin.id)
      |> preload(:node)
      |> Repo.all()
      |> Enum.reject(&hidden_node?/1)

    nodes =
      DocsTreeNode
      |> where([node], node.community_id == ^community.id)
      |> where([node], node.stage == CMS.Const.stage(:public))
      |> order_by([node], asc: node.index, asc: node.id)
      |> Repo.all()

    children_by_parent = Enum.group_by(nodes, & &1.parent_node_id)
    page_nodes = Enum.filter(nodes, &(&1.type == :page))
    public_docs_by_doc_id = public_docs_by_doc_id(community, page_nodes, pinned_docs)
    pinned_docs = Enum.filter(pinned_docs, &Map.has_key?(public_docs_by_doc_id, &1.node.doc_id))
    draft_nodes_by_node_id = draft_nodes_by_node_id(community, nodes)

    {:ok,
     %{
       cards:
         Enum.map(cards, fn card ->
           group = card.group_node

           %{
             id: card.id,
             group_node_id: group.node_id,
             index: card.index,
             appearance: card.appearance || %{},
             title: group.title,
             items:
               children_by_parent
               |> Map.get(group.node_id, [])
               |> Enum.map(
                 &card_item(
                   community,
                   view,
                   public_docs_by_doc_id,
                   draft_nodes_by_node_id,
                   children_by_parent,
                   &1
                 )
               )
               |> Enum.reject(&is_nil/1)
           }
         end),
       pinned_docs:
         Enum.map(
           pinned_docs,
           &pinned_doc_map(
             community,
             view,
             public_docs_by_doc_id,
             draft_nodes_by_node_id,
             &1
           )
         )
     }}
  end

  defp authorize_view(community, :public, _actor) do
    context = CMS.Gate.Context.Scope.Community.public()

    case CMS.Gate.scope(Community, nil, :read, context) do
      %Ecto.Query{} = query ->
        if Repo.exists?(where(query, [site], site.id == ^community.id)) do
          {:ok, :pass}
        else
          {:error, CMS.Communities.ErrorCat.not_exist("Community")}
        end

      {:error, _} = error ->
        error
    end
  end

  defp authorize_view(%Community{} = community, :dashboard, %User{} = actor) do
    case CMS.Gate.access_check(actor, :manage_docs, community) do
      {:ok, _canonical} -> {:ok, :pass}
      {:error, decision} -> {:error, decision}
    end
  end

  defp authorize_view(_community, :dashboard, _actor) do
    {:error, GroupherServer.Accounts.profiles_error_cat_account_login()}
  end

  defp card_item(
         _community,
         _view,
         _public_docs_by_doc_id,
         _draft_nodes_by_node_id,
         _children_by_parent,
         %DocsTreeNode{hidden: true}
       ) do
    nil
  end

  defp card_item(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         _children_by_parent,
         %DocsTreeNode{type: type} = node
       )
       when type in [:page, :link] do
    item = node_map(community, view, public_docs_by_doc_id, draft_nodes_by_node_id, node)

    if displayable_item?(item), do: item, else: nil
  end

  defp card_item(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         children_by_parent,
         %DocsTreeNode{type: :group} = group
       ) do
    leaves =
      visible_leaves(
        community,
        view,
        public_docs_by_doc_id,
        draft_nodes_by_node_id,
        children_by_parent,
        group.node_id,
        MapSet.new()
      )

    case leaves do
      [] ->
        nil

      [first | _] ->
        %{
          id: group.node_id,
          node_id: group.node_id,
          type: :group,
          title: group.title,
          index: group.index,
          href: first.href,
          marker: group.marker,
          badge: group.badge,
          leaf_count: length(leaves)
        }
    end
  end

  defp card_item(_community, _view, _docs, _drafts, _children, _node), do: nil

  defp visible_leaves(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         children_by_parent,
         parent_node_id,
         seen
       ) do
    if MapSet.member?(seen, parent_node_id) do
      []
    else
      seen = MapSet.put(seen, parent_node_id)

      children_by_parent
      |> Map.get(parent_node_id, [])
      |> Enum.flat_map(fn
        %DocsTreeNode{hidden: true} ->
          []

        %DocsTreeNode{type: :group} = group ->
          visible_leaves(
            community,
            view,
            public_docs_by_doc_id,
            draft_nodes_by_node_id,
            children_by_parent,
            group.node_id,
            seen
          )

        %DocsTreeNode{type: type} = node when type in [:page, :link] ->
          node
          |> node_map(community, view, public_docs_by_doc_id, draft_nodes_by_node_id)
          |> displayable_item()

        _node ->
          []
      end)
    end
  end

  defp displayable_item(item), do: if(displayable_item?(item), do: [item], else: [])

  defp node_map(
         %DocsTreeNode{} = node,
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id
       ) do
    node_map(community, view, public_docs_by_doc_id, draft_nodes_by_node_id, node)
  end

  defp node_map(
         %Community{} = community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         %DocsTreeNode{} = node
       ) do
    %{
      id: node.node_id,
      node_id: node.node_id,
      doc_id: node.doc_id,
      type: node.type,
      title: node.title,
      index: node.index,
      href:
        node_href(
          community,
          view,
          node,
          Map.get(public_docs_by_doc_id, node.doc_id),
          Map.get(draft_nodes_by_node_id, node.node_id)
        ),
      marker: node.marker,
      badge: node.badge
    }
  end

  defp pinned_doc_map(
         community,
         view,
         public_docs_by_doc_id,
         draft_nodes_by_node_id,
         %DocCoverPinnedDoc{} = pinned_doc
       ) do
    node =
      node_map(
        community,
        view,
        public_docs_by_doc_id,
        draft_nodes_by_node_id,
        pinned_doc.node
      )

    %{
      node_id: node.id,
      index: pinned_doc.index,
      appearance: pinned_doc.appearance || %{"light" => %{}, "dark" => %{}},
      href: node.href,
      doc: Map.fetch!(public_docs_by_doc_id, node.doc_id)
    }
  end

  defp node_href(
         %Community{slug: community},
         :public,
         %DocsTreeNode{type: :page},
         %{inner_id: inner_id, slug: slug},
         _draft_node
       )
       when not is_nil(inner_id) do
    path = "/#{community}/doc/#{inner_id}"
    if is_binary(slug) and slug != "", do: path <> "/" <> slug, else: path
  end

  defp node_href(_community, :public, %DocsTreeNode{type: :link, href: href}, _doc, _draft)
       when is_binary(href) and href != "" do
    href
  end

  defp node_href(%Community{slug: community}, :dashboard, %DocsTreeNode{type: :page}, _doc, %{
         doc_id: doc_id
       })
       when not is_nil(doc_id) do
    "/#{community}/doc/editor?#{URI.encode_query(%{docId: doc_id})}"
  end

  defp node_href(_community, :dashboard, %DocsTreeNode{type: :link, href: href}, _doc, _draft)
       when is_binary(href) and href != "" do
    href
  end

  defp node_href(_community, _view, _node, _doc, _draft), do: nil

  defp hidden_node?(%{node: %{hidden: true}}), do: true
  defp hidden_node?(_item), do: false

  defp displayable_item?(%{href: href}) when is_binary(href) and href != "", do: true
  defp displayable_item?(_item), do: false

  defp public_docs_by_doc_id(%Community{} = community, page_nodes, pinned_docs) do
    doc_ids =
      [Enum.map(page_nodes, & &1.doc_id), Enum.map(pinned_docs, & &1.node.doc_id)]
      |> Enum.concat()
      |> Enum.reject(&is_nil/1)
      |> Enum.uniq()

    public_binding_ids = CMS.Articles.Pagination.public_binding_ids(:doc)

    from(article in Article,
      join: binding in ArticleBinding,
      on: binding.article_id == article.id,
      join: public in ArticlePublic,
      on: public.article_id == article.id,
      join: body in ArticlePublicBody,
      on: body.article_id == public.article_id and body.snapshot_id == public.snapshot_id,
      where:
        binding.community_id == ^community.id and binding.id in subquery(public_binding_ids) and
          article.id in ^doc_ids,
      select: %{
        id: article.id,
        inner_id: binding.inner_id,
        slug: public.slug,
        title: public.title,
        thumbnail: body.thumbnail
      }
    )
    |> Repo.all()
    |> Map.new(&{&1.id, &1})
  end

  defp draft_nodes_by_node_id(%Community{} = community, public_nodes) do
    node_ids = Enum.map(public_nodes, & &1.node_id)

    DocsTreeNode
    |> where([node], node.community_id == ^community.id)
    |> where([node], node.stage == CMS.Const.stage(:draft))
    |> where([node], node.node_id in ^node_ids)
    |> Repo.all()
    |> Map.new(&{&1.node_id, &1})
  end
end
