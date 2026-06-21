defmodule GroupherServer.CMS.Articles.Revision do
  @moduledoc """
  Version history service for Groupher article content.

  This module owns the common draft/published revision chain for article
  threads. It intentionally stays article-scoped: comments are frontend-only for
  now and should not share this table or service.

      ArticleDraft(thread=post/doc/changelog/blog)
          |
          | checkpoint_article_draft/4
          v
      ArticleRevision(type=draft, article_draft_id=draft.id)
          |
          | publish_article_draft/3
          v
      Thread article table
          |
          +--> ArticleRevision(type=published, article_id=article.id)
          +--> clear ArticleRevision(type=draft, article_draft_id=draft.id)

  Restore keeps the product model linear instead of git-like. Restoring a draft
  checkpoint deletes later draft checkpoints. Restoring a published revision
  deletes later published revisions for that article and all current draft
  checkpoints for the staged copy.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.{Draft, Write}
  alias CMS.Model.{ArticleDraft, ArticleRevision, Author, Community}
  alias Helper.{ORM, T, Transaction}

  @default_limit 30

  @doc """
  Lists revision history visible from one staged article draft.

  Draft checkpoints are matched by `article_draft_id`. If the draft has already
  been published once, published revisions are matched by its `article_id`.

  ## Examples

      iex> Revision.list_article_draft(community, draft.id, type: :draft)
      {:ok, [%ArticleRevision{type: :draft}]}

      iex> Revision.list_article_draft(community, draft.id, type: :published, limit: 5)
      {:ok, [%ArticleRevision{type: :published}]}
  """
  @spec list_article_draft(Community.t(), T.id(), keyword()) ::
          T.domain_res([ArticleRevision.t()])
  def list_article_draft(%Community{} = community, article_draft_id, opts \\ []) do
    with {:ok, draft} <- read_article_draft(community, article_draft_id) do
      draft
      |> article_draft_revisions_query()
      |> maybe_filter_type(Keyword.get(opts, :type))
      |> order_by([r], desc: r.revision_number, desc: r.id)
      |> limit(^Keyword.get(opts, :limit, @default_limit))
      |> Repo.all()
      |> then(&{:ok, &1})
    end
  end

  @doc """
  Fetches one revision that belongs to the staged draft chain.

  ## Examples

      iex> Revision.get_article_draft_revision(community, draft.id, revision.id)
      {:ok, %ArticleRevision{}}
  """
  @spec get_article_draft_revision(Community.t(), T.id(), T.id()) ::
          T.domain_res(ArticleRevision.t())
  def get_article_draft_revision(%Community{} = community, article_draft_id, revision_id) do
    with {:ok, draft} <- read_article_draft(community, article_draft_id) do
      draft
      |> article_draft_revisions_query()
      |> where([r], r.id == ^revision_id)
      |> Repo.one()
      |> case do
        %ArticleRevision{} = revision -> {:ok, revision}
        nil -> {:error, {:not_exist, "article revision #{revision_id}"}}
      end
    end
  end

  @doc """
  Creates a draft checkpoint from the current staged content.

  Unchanged draft checkpoints are skipped by comparing the latest checkpoint's
  `content_hash`. Pass `force: true` only for explicit product events that must
  be materialized.

  ## Examples

      iex> Revision.checkpoint_article_draft(community, draft.id, user)
      {:ok, %ArticleRevision{type: :draft, article_draft_id: draft.id}}
  """
  @spec checkpoint_article_draft(Community.t(), T.id(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleRevision.t())
  def checkpoint_article_draft(
        %Community{} = community,
        article_draft_id,
        user \\ nil,
        opts \\ []
      ) do
    type = Keyword.get(opts, :type, :draft)
    force? = Keyword.get(opts, :force, false)

    with {:ok, draft} <- read_article_draft(community, article_draft_id),
         {:ok, attrs} <- revision_attrs_from_article_draft(community, draft, type, user) do
      attrs
      |> put_next_revision_number()
      |> maybe_create_draft_revision(force?)
    end
  end

  @doc """
  Saves a published article snapshot.

  Published revisions are not deduplicated. A publish is a product event, so two
  publishes with equal content should still produce two published revision rows.

  ## Examples

      iex> Revision.checkpoint_published(post, user)
      {:ok, %ArticleRevision{type: :published, thread: :post}}
  """
  @spec checkpoint_published(T.article(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleRevision.t())
  def checkpoint_published(article, user \\ nil, opts \\ []) do
    type = Keyword.get(opts, :type, :published)

    with {:ok, attrs} <- revision_attrs_from_article(article, type, user) do
      attrs
      |> put_next_revision_number()
      |> then(&ORM.create(ArticleRevision, &1))
    end
  end

  @doc """
  Publishes a staged draft and records the published revision.

  The draft is first copied into the thread article table through
  `CMS.Articles.Draft.publish/3`. After the published snapshot is recorded,
  draft checkpoints are deleted because they no longer represent unpublished
  work.

  ## Examples

      iex> Revision.publish_article_draft(community, draft.id, user)
      {:ok, %ArticleRevision{type: :published}}
  """
  @spec publish_article_draft(Community.t(), T.id(), User.t()) ::
          T.domain_res(ArticleRevision.t())
  def publish_article_draft(%Community{} = community, article_draft_id, %User{} = user) do
    Transaction.lock_global(Draft.lock_key(community, article_draft_id), fn ->
      with {:ok, article} <- Draft.publish_unlocked(community, article_draft_id, user),
           {:ok, revision} <- checkpoint_published(article, user),
           {:ok, _} <- clear_article_draft_checkpoints(community, article_draft_id) do
        {:ok, revision}
      end
    end)
  end

  @doc """
  Restores a revision into the staged draft.

  Draft restore trims later draft checkpoints. Published restore trims later
  published revisions for that article and clears staged checkpoints, keeping
  both tabs in a single linear timeline.

  ## Examples

      iex> Revision.restore_article_draft(community, draft.id, revision.id, user)
      {:ok, %ArticleDraft{}}
  """
  @spec restore_article_draft(Community.t(), T.id(), T.id(), User.t() | nil) ::
          T.domain_res(ArticleDraft.t())
  def restore_article_draft(%Community{} = community, article_draft_id, revision_id, _user \\ nil) do
    Transaction.lock_global(Draft.lock_key(community, article_draft_id), fn ->
      with {:ok, revision} <-
             get_article_draft_revision(community, article_draft_id, revision_id),
           {:ok, current_draft} <- Draft.read(community, article_draft_id),
           {:ok, draft} <-
             Draft.update_unlocked(
               community,
               article_draft_id,
               restore_attrs(revision, current_draft)
             ),
           {:ok, _} <- trim_revisions_after_restore(community, draft.id, revision) do
        {:ok, draft}
      end
    end)
  end

  @doc """
  Deletes temporary draft checkpoints for one staged draft.

  ## Examples

      iex> Revision.clear_article_draft_checkpoints(community, draft.id)
      {:ok, {3, nil}}
  """
  @spec clear_article_draft_checkpoints(Community.t(), T.id()) :: T.domain_res(term())
  def clear_article_draft_checkpoints(%Community{} = community, article_draft_id) do
    ArticleRevision
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.article_draft_id == ^article_draft_id)
    |> where([r], r.type == :draft)
    |> ORM.delete_all(:if_exist)
  end

  @doc """
  Deletes later published revisions for the same published article.

  ## Examples

      iex> Revision.trim_published_revisions_after_restore(community, revision)
      {:ok, {2, nil}}
  """
  @spec trim_published_revisions_after_restore(Community.t(), ArticleRevision.t()) ::
          T.domain_res(term())
  def trim_published_revisions_after_restore(
        %Community{} = community,
        %ArticleRevision{type: :published, article_id: article_id} = revision
      )
      when not is_nil(article_id) do
    ArticleRevision
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.thread == ^revision.thread)
    |> where([r], r.type == :published)
    |> where([r], r.article_id == ^article_id)
    |> where([r], is_nil(r.article_draft_id))
    |> where([r], r.revision_number > ^revision.revision_number)
    |> ORM.delete_all(:if_exist)
  end

  def trim_published_revisions_after_restore(_community, _revision), do: {:ok, {0, nil}}

  @doc """
  Docs-specific wrapper retained for the existing dashboard GraphQL field.

  ## Examples

      iex> Revision.list_doc_draft(community, article_draft_id)
      Revision.list_article_draft(community, article_draft_id)
  """
  @spec list_doc_draft(Community.t(), T.id(), keyword()) :: T.domain_res([ArticleRevision.t()])
  def list_doc_draft(community, article_draft_id, opts \\ []),
    do: list_article_draft(community, article_draft_id, opts)

  @doc """
  Docs-specific wrapper around `get_article_draft_revision/3`.
  """
  @spec get_doc_draft_revision(Community.t(), T.id(), T.id()) ::
          T.domain_res(ArticleRevision.t())
  def get_doc_draft_revision(community, article_draft_id, revision_id),
    do: get_article_draft_revision(community, article_draft_id, revision_id)

  @doc """
  Docs-specific wrapper around `checkpoint_article_draft/4`.
  """
  @spec checkpoint_doc_draft(Community.t(), T.id(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleRevision.t())
  def checkpoint_doc_draft(community, article_draft_id, user \\ nil, opts \\ []),
    do: checkpoint_article_draft(community, article_draft_id, user, opts)

  @doc """
  Docs-specific wrapper around `publish_article_draft/3`.
  """
  @spec publish_doc_draft(Community.t(), T.id(), User.t()) :: T.domain_res(ArticleRevision.t())
  def publish_doc_draft(community, article_draft_id, user),
    do: publish_article_draft(community, article_draft_id, user)

  @doc """
  Docs-specific wrapper around `restore_article_draft/4`.
  """
  @spec restore_doc_draft(Community.t(), T.id(), T.id(), User.t() | nil) ::
          T.domain_res(ArticleDraft.t())
  def restore_doc_draft(community, article_draft_id, revision_id, user \\ nil),
    do: restore_article_draft(community, article_draft_id, revision_id, user)

  @doc """
  Docs-specific wrapper around `clear_article_draft_checkpoints/2`.
  """
  @spec clear_doc_draft_checkpoints(Community.t(), T.id()) :: T.domain_res(term())
  def clear_doc_draft_checkpoints(community, article_draft_id),
    do: clear_article_draft_checkpoints(community, article_draft_id)

  defp read_article_draft(%Community{} = community, article_draft_id) do
    Draft.read(community, article_draft_id)
  end

  defp article_draft_revisions_query(%ArticleDraft{} = draft) do
    query =
      ArticleRevision
      |> where([r], r.community_id == ^draft.community_id)
      |> where([r], r.thread == ^draft.thread)

    case draft.article_id do
      nil ->
        where(query, [r], r.article_draft_id == ^draft.id)

      article_id ->
        where(
          query,
          [r],
          r.article_draft_id == ^draft.id or
            (r.article_id == ^article_id and r.type == :published)
        )
    end
  end

  defp maybe_filter_type(query, nil), do: query
  defp maybe_filter_type(query, type), do: where(query, [r], r.type == ^type)

  defp maybe_create_draft_revision(%{type: :draft} = attrs, false) do
    case latest_revision(attrs, :draft) do
      %ArticleRevision{content_hash: content_hash} = revision
      when content_hash == attrs.content_hash ->
        {:ok, revision}

      _ ->
        ORM.create(ArticleRevision, attrs)
    end
  end

  defp maybe_create_draft_revision(attrs, _force?), do: ORM.create(ArticleRevision, attrs)

  # Timestamps are for display. The integer chain is the strict order used by
  # restore and diff history so same-second checkpoints still sort correctly.
  defp put_next_revision_number(%{} = attrs) do
    Map.put(attrs, :revision_number, next_revision_number(attrs))
  end

  defp next_revision_number(%{} = attrs) do
    ArticleRevision
    |> where([r], r.community_id == ^attrs.community_id)
    |> where([r], r.thread == ^attrs.thread)
    |> where([r], r.type == ^attrs.type)
    |> match_revision_target(attrs)
    |> select([r], max(r.revision_number))
    |> Repo.one()
    |> case do
      nil -> 1
      number -> number + 1
    end
  end

  defp match_revision_target(query, %{article_id: article_id}) when not is_nil(article_id) do
    query
    |> where([r], r.article_id == ^article_id)
    |> where([r], is_nil(r.article_draft_id))
  end

  defp match_revision_target(query, %{article_draft_id: article_draft_id})
       when not is_nil(article_draft_id) do
    query
    |> where([r], r.article_draft_id == ^article_draft_id)
    |> where([r], is_nil(r.article_id))
  end

  defp match_revision_target(query, _attrs), do: query

  defp latest_revision(%{community_id: community_id, thread: thread} = attrs, type) do
    ArticleRevision
    |> where([r], r.community_id == ^community_id)
    |> where([r], r.thread == ^thread)
    |> where([r], r.type == ^type)
    |> match_revision_target(attrs)
    |> order_by([r], desc: r.revision_number, desc: r.id)
    |> limit(1)
    |> Repo.one()
  end

  defp trim_revisions_after_restore(
         %Community{} = community,
         article_draft_id,
         %ArticleRevision{type: :draft, article_draft_id: article_draft_id} = revision
       ) do
    ArticleRevision
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.thread == ^revision.thread)
    |> where([r], r.article_draft_id == ^article_draft_id)
    |> where([r], r.type == :draft)
    |> where([r], r.revision_number > ^revision.revision_number)
    |> ORM.delete_all(:if_exist)
  end

  defp trim_revisions_after_restore(
         %Community{} = community,
         article_draft_id,
         %ArticleRevision{type: :published} = revision
       ) do
    with {:ok, _} <- trim_published_revisions_after_restore(community, revision) do
      clear_article_draft_checkpoints(community, article_draft_id)
    end
  end

  defp revision_attrs_from_article_draft(
         %Community{} = community,
         %ArticleDraft{} = draft,
         type,
         user
       ) do
    with {:ok, author_id} <- author_id(user) do
      {:ok,
       %{
         community_id: community.id,
         thread: draft.thread,
         type: type,
         article_draft_id: draft.id,
         author_id: author_id || draft.author_id,
         title: draft.title,
         slug: draft.slug,
         digest: draft.digest,
         document_json: draft.json,
         content_hash: draft.content_hash,
         schema_version: draft.schema_version || 1
       }}
    end
  end

  defp revision_attrs_from_article(article, type, user) do
    article = Repo.preload(article, [:document, :community])

    with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
         {:ok, document} <- require_document(article),
         {:ok, author_id} <- author_id(user) do
      {:ok,
       %{
         community_id: article.community_id,
         thread: thread,
         type: type,
         article_id: article.id,
         author_id: author_id || article.author_id,
         title: article.title,
         slug: Map.get(article, :slug),
         digest: article.digest || Map.get(document, :digest),
         document_json: document.json,
         content_hash: document.content_hash,
         schema_version: document.schema_version || 1
       }}
    end
  end

  defp require_document(%{document: %{json: json, content_hash: hash} = document})
       when is_binary(json) and is_binary(hash) do
    {:ok, document}
  end

  defp require_document(_), do: {:error, {:custom, "article revision requires document json"}}

  defp author_id(nil), do: {:ok, nil}

  defp author_id(%User{} = user) do
    with {:ok, %Author{id: id}} <- Write.ensure_author_exists(user), do: {:ok, id}
  end

  defp restore_attrs(%ArticleRevision{} = revision, %ArticleDraft{} = draft) do
    %{title: revision.title, body: revision.document_json}
    |> maybe_put_slug(revision.slug || draft.slug)
  end

  defp maybe_put_slug(attrs, slug) when is_binary(slug), do: Map.put(attrs, :slug, slug)
  defp maybe_put_slug(attrs, _slug), do: attrs
end
