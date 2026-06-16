defmodule GroupherServer.CMS.DocTree.Template do
  @moduledoc """
  Demo template management for docs draft workspaces.

  The template is dashboard-only. It creates draft tree nodes and draft docs so
  a new community has editable docs content immediately, but it never writes to
  the published `docs` or `doc_tree_nodes` tables.

      ensure_demo_template
              |
              v
      if doc_tree_node_drafts is empty
              |
              v
      create demo groups/pages
              |
              +-- group -> doc_tree_node_drafts
              +-- page  -> doc_drafts + doc_document_drafts
                         -> doc_tree_node_drafts.doc_draft_id

  `template_key` marks all generated rows. The internal delete/reset helpers use
  this marker to remove only demo draft content and leave user-created draft
  content untouched.
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Articles.Write, only: [ensure_author_exists: 1]

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.DocTree.{Read, Revision}

  alias CMS.Model.{
    Author,
    Community,
    DocDocumentDraft,
    DocDraft,
    DocTreeNodeDraft
  }

  alias Helper.{ContentPayload, ContentPipeline, ORM, T, Transaction}

  @template [
    %{
      key: "getting-started",
      title: "Getting started",
      slug: "getting-started",
      pages: [
        %{key: "introduction", title: "Introduction", slug: "introduction"},
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
      if draft_tree_empty?(community) do
        do_create_demo_template(community, user)
      else
        Read.read(community)
      end
    end)
  end

  @spec reset_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def reset_demo_template(%Community{} = community, %User{} = user) do
    lock_template(community, fn ->
      with {:ok, _} <- do_delete_demo_template(community) do
        do_create_demo_template(community, user)
      end
    end)
  end

  @spec create_demo_template(Community.t(), User.t()) :: T.domain_res(map())
  def create_demo_template(%Community{} = community, %User{} = user) do
    lock_template(community, fn ->
      do_create_demo_template(community, user)
    end)
  end

  @spec delete_demo_template(Community.t()) :: T.domain_res(map())
  def delete_demo_template(%Community{} = community) do
    lock_template(community, fn ->
      do_delete_demo_template(community)
    end)
  end

  defp do_create_demo_template(%Community{} = community, %User{} = user) do
    with {:ok, _site_state} <- Read.ensure_site_state(community),
         {:ok, state} <- Read.ensure_draft_state(community),
         {:ok, author} <- ensure_author_exists(user) do
      Enum.with_index(@template)
      |> Enum.reduce_while({:ok, []}, fn {group, index}, {:ok, acc} ->
        case create_group(community, group, index, author) do
          {:ok, _group} = result -> {:cont, {:ok, [result | acc]}}
          {:error, _} = error -> {:halt, error}
        end
      end)
      |> case do
        {:ok, _} ->
          with {:ok, _state} <- Revision.bump_draft(community, state),
               {:ok, tree} <- Read.read(community) do
            {:ok, tree}
          end

        error ->
          error
      end
    end
  end

  defp do_delete_demo_template(%Community{} = community) do
    with {:ok, _site_state} <- Read.ensure_site_state(community),
         {:ok, state} <- Read.ensure_draft_state(community) do
      template_keys = template_keys()

      DocTreeNodeDraft
      |> where([n], n.community_id == ^community.id)
      |> where([n], n.template_key in ^template_keys)
      |> Repo.delete_all()

      DocDraft
      |> where([d], d.community_id == ^community.id)
      |> where([d], d.template_key in ^template_keys)
      |> Repo.delete_all()

      with {:ok, _state} <- Revision.bump_draft(community, state),
           {:ok, tree} <- Read.read(community) do
        {:ok, tree}
      end
    end
  end

  defp create_group(%Community{} = community, group, index, %Author{} = author) do
    attrs = %{
      community_id: community.id,
      type: :group,
      title: group.title,
      slug: group.slug,
      index: index,
      parent_id: nil,
      expanded: true,
      template_key: template_key(group.key)
    }

    with {:ok, node} <- ORM.create(DocTreeNodeDraft, attrs),
         {:ok, _pages} <- create_pages(community, node, group.key, group.pages, author) do
      {:ok, node}
    end
  end

  defp create_pages(
         %Community{} = community,
         %DocTreeNodeDraft{} = group,
         group_key,
         pages,
         %Author{} = author
       ) do
    pages
    |> Enum.with_index()
    |> Enum.reduce_while({:ok, []}, fn {page, index}, {:ok, acc} ->
      case create_page(community, group, group_key, page, index, author) do
        {:ok, node} -> {:cont, {:ok, [node | acc]}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp create_page(
         %Community{} = community,
         %DocTreeNodeDraft{} = group,
         group_key,
         page,
         index,
         %Author{} = author
       ) do
    with {:ok, draft} <- create_doc_draft(community, page, author) do
      attrs = %{
        community_id: community.id,
        parent_id: group.id,
        doc_draft_id: draft.id,
        type: :page,
        title: page.title,
        slug: page.slug,
        index: index,
        template_key: template_key("#{group_key}:#{page.key}")
      }

      ORM.create(DocTreeNodeDraft, attrs)
    end
  end

  defp create_doc_draft(%Community{} = community, page, %Author{} = author) do
    with {:ok, payload} <- page_content_payload(page),
         {:ok, draft} <-
           ORM.create(DocDraft, %{
             community_id: community.id,
             author_id: author.id,
             title: page.title,
             slug: page.slug,
             digest: payload.digest,
             template_key: template_key("doc:#{page.key}")
           }),
         {:ok, _document} <-
           payload
           |> ContentPayload.pick_valid_fields()
           |> Map.put(:doc_draft_id, draft.id)
           |> then(&ORM.create(DocDocumentDraft, &1)) do
      {:ok, draft}
    end
  end

  defp page_content_payload(page) do
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
    |> then(&ContentPipeline.parse(%{body: &1}))
  end

  defp draft_tree_empty?(%Community{} = community) do
    DocTreeNodeDraft
    |> where([n], n.community_id == ^community.id)
    |> Repo.exists?()
    |> Kernel.not()
  end

  defp template_keys do
    Enum.flat_map(@template, fn group ->
      group_key = template_key(group.key)
      page_keys = Enum.map(group.pages, &template_key("#{group.key}:#{&1.key}"))
      doc_keys = Enum.map(group.pages, &template_key("doc:#{&1.key}"))
      [group_key | page_keys ++ doc_keys]
    end)
  end

  defp lock_template(%Community{} = community, fun) when is_function(fun, 0) do
    Transaction.lock_global("doc_tree:template:#{community.id}", fun)
  end

  defp template_key(key), do: "demo:#{key}"
end
