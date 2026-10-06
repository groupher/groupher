defmodule GroupherServer.CMS.DocTree.Writer.DraftDoc do
  @moduledoc """
  Keeps docs page nodes connected to draft article content.

      create_page input
          |
          +--> doc_id present -> validate draft doc belongs to community
          +--> user present   -> create default draft doc
          +--> no user/doc_id -> leave doc_id unset
          |
          v
      args with doc_id

      update_draft
          |
          v
      Draft.update_or_create_from_public
          |
          v
      bump site draft revision only

  Tree node writes and article-content writes intentionally bump different
  revision counters. This module owns the article-content side of docs writes.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, ErrorCat, Repo}

  alias Accounts.Model.User
  alias CMS.Articles.Draft.Store
  alias CMS.Artiment.BodyBag
  alias CMS.DocTree.{Revision, State}
  alias CMS.Model.{Article, Community, DocDraft}
  alias Helper.Validator.Slug

  @doc """
  Updates one docs draft's article content.

  The draft is created from the public doc when none exists, and only the site
  draft revision is bumped; tree revisions are owned by the tree writer.

  ## Examples

      DraftDoc.update(community, branch, doc_id, %{title: "New title", slug: "new-title"}, user)
      #=> {:ok, %CMS.Model.DocDraft{}}

  """
  def update(%Community{} = community, branch, doc_id, args, %User{} = user) do
    with :ok <- validate_update_attrs(args),
         {:ok, site_state} <- State.ensure_site_state(community, branch_id: branch.id),
         {:ok, draft} <- CMS.Docs.update_draft(doc_id, branch.id, args, user),
         {:ok, _state} <- Revision.bump_site_draft(community, site_state) do
      {:ok, draft}
    end
  end

  def ensure(%Community{} = community, branch, %{doc_id: doc_id} = args, _user)
      when not is_nil(doc_id) do
    with :ok <- validate(community, branch, doc_id), do: {:ok, args}
  end

  def ensure(_community, _branch, args, nil), do: {:ok, args}

  def ensure(%Community{} = community, branch, args, %User{} = user) do
    with {:ok, draft} <- create_default_doc_draft(community, branch, args, user) do
      {:ok, Map.put(args, :doc_id, draft.article_id)}
    end
  end

  def validate(_community, _branch, nil), do: :ok

  def validate(%Community{} = community, branch, doc_id) do
    DocDraft
    |> join(:inner, [draft], article in Article, on: article.id == draft.article_id)
    |> where([draft, article], article.community_id == ^community.id)
    |> where([draft], draft.branch_id == ^branch.id)
    |> where([draft], draft.article_id == ^doc_id)
    |> Repo.exists?()
    |> case do
      true -> :ok
      false -> {:error, ErrorCat.custom("doc draft not found in this community")}
    end
  end

  defp create_default_doc_draft(%Community{} = community, branch, args, %User{} = user) do
    title = Map.get(args, :title, "Untitled")
    slug = Map.get(args, :slug) || normalize_doc_slug(title)

    with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(user),
         {:ok, %{draft: draft}} <-
           Store.create(
             community,
             :doc,
             %{title: title, slug: slug, body_bag: BodyBag.empty_doc()},
             author,
             branch_id: branch.id
           ) do
      {:ok, draft}
    end
  end

  defp normalize_doc_slug(slug) do
    case Slug.normalize(slug) do
      "" -> "untitled"
      normalized -> normalized
    end
  end

  defp validate_update_attrs(%{title: _title} = attrs) do
    if Map.has_key?(attrs, :slug) do
      :ok
    else
      {:error, ErrorCat.custom("slug is required when updating a Doc title")}
    end
  end

  defp validate_update_attrs(_attrs), do: :ok
end
