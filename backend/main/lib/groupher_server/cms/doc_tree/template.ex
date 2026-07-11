defmodule GroupherServer.CMS.DocTree.Template do
  @moduledoc """
  Demo template management for docs drafts.

  The template is dashboard-only. It creates draft tree nodes and docs
  so a new community has editable docs content immediately, but it never writes
  to the published `docs` or `doc_tree_nodes` tables.

      ensure_demo_template
              |
              v
      if doc_tree_nodes(stage=draft) is empty
              |
              v
      create demo groups/pages
              |
              +-- group -> doc_tree_nodes(stage=draft, node_id=...)
              +-- page  -> docs(stage=draft)
                         -> doc_tree_nodes.group_id = group.node_id

  `template_key` marks all generated rows. The internal delete/reset helpers use
  this marker to remove only demo draft content and leave user-created draft
  content untouched.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Articles.Write, only: [ensure_author_exists: 1]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Articles.Draft
  alias CMS.DocTree.{Branch, Read, Revision}

  require CMS.Const

  alias CMS.Model.{
    Author,
    Doc,
    Community,
    DocTreeNode
  }

  alias Helper.{ORM, T, Transaction}

  @template [
    %{
      key: "getting-started",
      title: "Getting started",
      slug: "getting-started",
      pages: [
        %{key: "welcome", title: "Welcome", slug: "welcome"},
        %{key: "quick-start", title: "Quick start", slug: "quick-start"}
      ]
    },
    %{
      key: "core-features",
      title: "Core Features",
      slug: "core-features",
      pages: [
        %{key: "forum", title: "Forum", slug: "forum"},
        %{key: "changelog", title: "Changelog", slug: "changelog"}
      ]
    }
  ]

  @spec ensure_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def ensure_demo_template(%Community{} = community, %User{} = user) do
    lock_template(community, fn ->
      with {:ok, branch} <- Branch.resolve(community) do
        if draft_tree_empty?(community, branch) do
          do_create_demo_template(community, branch, user)
        else
          Read.read(community, branch)
        end
      end
    end)
  end

  @spec reset_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def reset_demo_template(%Community{} = community, %User{} = user) do
    lock_template(community, fn ->
      with {:ok, branch} <- Branch.resolve(community),
           {:ok, _} <- do_delete_demo_template(community, branch) do
        do_create_demo_template(community, branch, user)
      end
    end)
  end

  @spec create_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def create_demo_template(%Community{} = community, %User{} = user) do
    lock_template(community, fn ->
      with {:ok, branch} <- Branch.resolve(community) do
        do_create_demo_template(community, branch, user)
      end
    end)
  end

  @spec delete_demo_template(Community.t()) :: T.domain_res(map())
  def delete_demo_template(%Community{} = community) do
    lock_template(community, fn ->
      with {:ok, branch} <- Branch.resolve(community) do
        do_delete_demo_template(community, branch)
      end
    end)
  end

  defp do_create_demo_template(%Community{} = community, branch, %User{} = user) do
    with {:ok, _site_state} <- Read.ensure_site_state(community, branch),
         {:ok, state} <- Read.ensure_draft_state(community, branch),
         {:ok, author} <- ensure_author_exists(user),
         {:ok, tab} <- create_tab(community, branch) do
      Enum.with_index(@template)
      |> Enum.reduce_while({:ok, []}, fn {group, index}, {:ok, acc} ->
        case create_group(community, branch, tab, group, index, author) do
          {:ok, _group} = result -> {:cont, {:ok, [result | acc]}}
          {:error, _} = error -> {:halt, error}
        end
      end)
      |> case do
        {:ok, _} ->
          with {:ok, _state} <- Revision.bump_tree_draft(community, state),
               {:ok, tree} <- Read.read(community, branch) do
            {:ok, tree}
          end

        error ->
          error
      end
    end
  end

  defp create_tab(%Community{} = community, branch) do
    ORM.create(DocTreeNode, %{
      community_id: community.id,
      branch_id: branch.id,
      node_id: template_node_id("tab:introduction"),
      stage: CMS.Const.stage(:draft),
      type: :tab,
      title: "Introduction",
      slug: "introduction",
      index: 0,
      template_key: template_key("tab:introduction")
    })
  end

  defp do_delete_demo_template(%Community{} = community, branch) do
    with {:ok, _site_state} <- Read.ensure_site_state(community, branch),
         {:ok, state} <- Read.ensure_draft_state(community, branch) do
      template_keys = template_keys()

      DocTreeNode
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.branch_id == ^branch.id)
      |> where([n], n.template_key in ^template_keys)
      |> Repo.delete_all()

      Doc
      |> where([d], d.community_id == ^community.id)
      |> where([d], d.branch_id == ^branch.id)
      |> where([d], d.template_key in ^template_keys)
      |> Repo.delete_all()

      with {:ok, _state} <- Revision.bump_tree_draft(community, state),
           {:ok, tree} <- Read.read(community, branch) do
        {:ok, tree}
      end
    end
  end

  defp create_group(
         %Community{} = community,
         branch,
         %DocTreeNode{} = tab,
         group,
         index,
         %Author{} = author
       ) do
    attrs = %{
      community_id: community.id,
      branch_id: branch.id,
      node_id: template_node_id("group:#{group.key}"),
      stage: CMS.Const.stage(:draft),
      type: :group,
      tab_id: tab.node_id,
      title: group.title,
      slug: group.slug,
      index: index,
      group_id: nil,
      template_key: template_key(group.key)
    }

    with {:ok, node} <- ORM.create(DocTreeNode, attrs),
         {:ok, _pages} <- create_pages(community, branch, node, group.key, group.pages, author) do
      {:ok, node}
    end
  end

  defp create_pages(
         %Community{} = community,
         branch,
         %DocTreeNode{} = group,
         group_key,
         pages,
         %Author{} = author
       ) do
    pages
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {page, index}, {:ok, acc} ->
      case create_page(community, branch, group, group_key, page, index, author) do
        {:ok, node} -> {:cont, {:ok, [node | acc]}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp create_page(
         %Community{} = community,
         branch,
         %DocTreeNode{} = group,
         group_key,
         page,
         index,
         %Author{} = author
       ) do
    with {:ok, draft} <- create_doc_draft(community, branch, page, author) do
      attrs = %{
        community_id: community.id,
        branch_id: branch.id,
        node_id: template_node_id("page:#{group_key}:#{page.key}"),
        stage: CMS.Const.stage(:draft),
        group_id: group.node_id,
        doc_id: draft.doc_id,
        type: :page,
        title: page.title,
        slug: page.slug,
        index: index,
        template_key: template_key("#{group_key}:#{page.key}")
      }

      ORM.create(DocTreeNode, attrs)
    end
  end

  defp create_doc_draft(%Community{} = community, branch, page, %Author{} = author) do
    Draft.create_with_author(
      community,
      :doc,
      %{
        branch_id: branch.id,
        title: page.title,
        slug: page.slug,
        body: page_content(page),
        template_key: template_key("doc:#{page.key}")
      },
      author
    )
  end

  defp page_content(page) do
    [
      %{
        "type" => "h1",
        "children" => [%{"text" => page.title}]
      },
      %{
        "type" => "p",
        "children" => [
          %{
            "text" =>
              "Use this draft page as a starting point, then publish when your docs are ready."
          }
        ]
      }
    ]
    |> Jason.encode!()
  end

  defp draft_tree_empty?(%Community{} = community, branch) do
    DocTreeNode
    |> where([n], n.community_id == ^community.id)
    |> where([n], n.branch_id == ^branch.id)
    |> where([n], n.stage == CMS.Const.stage(:draft))
    |> Repo.exists?()
    |> Kernel.not()
  end

  defp template_keys do
    [
      template_key("tab:introduction")
      | Enum.flat_map(@template, fn group ->
          group_key = template_key(group.key)
          page_keys = Enum.map(group.pages, &template_key("#{group.key}:#{&1.key}"))
          doc_keys = Enum.map(group.pages, &template_key("doc:#{&1.key}"))
          [group_key | page_keys ++ doc_keys]
        end)
    ]
  end

  defp lock_template(%Community{} = community, fun) when is_function(fun, 0) do
    Transaction.lock_global("doc_tree:template:#{community.id}", fun)
  end

  defp template_key(key), do: "demo:#{key}"
  defp template_node_id(key), do: "demo:#{key}"
end
