defmodule GroupherServer.CMS.Articles.Snapshot do
  @moduledoc """
  Version history service for Groupher article content.

  This module owns the common draft/public snapshot chain for article
  threads. It intentionally stays article-scoped: comments are frontend-only for
  now and should not share this table or service.

      ArticleWorkspace(article_thread=post/doc/changelog/blog)
          |
          | checkpoint_article_workspace/4
          v
      ArticleSnapshot(stage=draft, workspace_id=draft.id)
          |
          | publish_article_workspace/3
          v
      Thread article table
          |
          +--> ArticleSnapshot(stage=public, article_id=article.id)
          +--> clear ArticleSnapshot(stage=draft, workspace_id=draft.id)

  Restore keeps the product model linear instead of git-like. Restoring a draft
  checkpoint deletes later draft checkpoints. Restoring a public snapshot hides
  later public snapshots from the article history when possible, but preserves
  any immutable snapshot already referenced by a docs publish release.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.{Draft, Write}
  alias CMS.Model.{ArticleWorkspace, ArticleSnapshot, Author, Community, PublishReleaseArticle}
  alias Helper.{ORM, T, Transaction}

  @default_limit 30

  @doc """
  Lists snapshot history visible from one staged article version.

  Draft checkpoints are matched by `workspace_id`. If the draft has already
  been published once, public snapshots are matched by its `article_id`.

  ## Examples

      iex> Snapshot.list_article_workspace(community, draft.id, stage: :draft)
      {:ok, [%ArticleSnapshot{stage: :draft}]}

      iex> Snapshot.list_article_workspace(community, draft.id, stage: :public, limit: 5)
      {:ok, [%ArticleSnapshot{stage: :public}]}
  """
  @spec list_article_workspace(Community.t(), T.id(), keyword()) ::
          T.domain_res([ArticleSnapshot.t()])
  def list_article_workspace(%Community{} = community, workspace_id, opts \\ []) do
    with {:ok, draft} <- read_article_workspace(community, workspace_id) do
      draft
      |> article_workspace_snapshots_query()
      |> maybe_filter_type(Keyword.get(opts, :stage))
      |> order_by([r], desc: r.snapshot_number, desc: r.id)
      |> limit(^Keyword.get(opts, :limit, @default_limit))
      |> Repo.all()
      |> then(&{:ok, &1})
    end
  end

  @doc """
  Fetches one snapshot that belongs to the staged draft chain.

  ## Examples

      iex> Snapshot.get_article_workspace_snapshot(community, draft.id, snapshot.id)
      {:ok, %ArticleSnapshot{}}
  """
  @spec get_article_workspace_snapshot(Community.t(), T.id(), T.id()) ::
          T.domain_res(ArticleSnapshot.t())
  def get_article_workspace_snapshot(%Community{} = community, workspace_id, snapshot_id) do
    with {:ok, draft} <- read_article_workspace(community, workspace_id) do
      draft
      |> article_workspace_snapshots_query()
      |> where([r], r.id == ^snapshot_id)
      |> Repo.one()
      |> case do
        %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
        nil -> {:error, {:not_exist, "article snapshot #{snapshot_id}"}}
      end
    end
  end

  @doc """
  Creates a draft checkpoint from the current staged content.

  Unchanged draft checkpoints are skipped by comparing the latest checkpoint's
  `content_hash`. Pass `force: true` only for explicit product events that must
  be materialized.

  ## Examples

      iex> Snapshot.checkpoint_article_workspace(community, draft.id, user)
      {:ok, %ArticleSnapshot{stage: :draft, workspace_id: draft.id}}
  """
  @spec checkpoint_article_workspace(Community.t(), T.id(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleSnapshot.t())
  def checkpoint_article_workspace(
        %Community{} = community,
        workspace_id,
        user \\ nil,
        opts \\ []
      ) do
    stage = Keyword.get(opts, :stage, :draft)
    force? = Keyword.get(opts, :force, false)

    with {:ok, draft} <- read_article_workspace(community, workspace_id),
         {:ok, attrs} <- snapshot_attrs_from_article_workspace(community, draft, stage, user) do
      attrs
      |> put_next_snapshot_number()
      |> maybe_create_draft_snapshot(force?)
    end
  end

  @doc """
  Saves a published article snapshot.

  Published snapshots are not deduplicated. A publish is a product event, so two
  publishes with equal content should still produce two public snapshot rows.

  ## Examples

      iex> Snapshot.checkpoint_published(post, user)
      {:ok, %ArticleSnapshot{stage: :public, article_thread: :post}}
  """
  @spec checkpoint_published(T.article(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleSnapshot.t())
  def checkpoint_published(article, user \\ nil, opts \\ []) do
    stage = Keyword.get(opts, :stage, :public)

    with {:ok, attrs} <- snapshot_attrs_from_article(article, stage, user) do
      attrs
      |> put_next_snapshot_number()
      |> then(&ORM.create(ArticleSnapshot, &1))
    end
  end

  @doc """
  Publishes a staged draft and records the public snapshot.

  The draft is first copied into the article_thread article table through
  `CMS.Articles.Draft.publish/3`. After the public snapshot is recorded,
  draft checkpoints are deleted because they no longer represent unpublished
  work.

  ## Examples

      iex> Snapshot.publish_article_workspace(community, draft.id, user)
      {:ok, %ArticleSnapshot{stage: :public}}
  """
  @spec publish_article_workspace(Community.t(), T.id(), User.t()) ::
          T.domain_res(ArticleSnapshot.t())
  def publish_article_workspace(%Community{} = community, workspace_id, %User{} = user) do
    Transaction.lock_global(Draft.lock_key(community, workspace_id), fn ->
      with {:ok, article} <- Draft.publish_unlocked(community, workspace_id, user),
           {:ok, snapshot} <- checkpoint_published(article, user),
           {:ok, _} <- clear_article_workspace_checkpoints(community, workspace_id) do
        {:ok, snapshot}
      end
    end)
  end

  @doc """
  Restores a snapshot into the staged draft.

  Draft restore trims later draft checkpoints. Published restore trims later
  public snapshots for that article and clears staged checkpoints, keeping
  both tabs in a single linear timeline.

  ## Examples

      iex> Snapshot.restore_article_workspace(community, draft.id, snapshot.id, user)
      {:ok, %ArticleWorkspace{}}
  """
  @spec restore_article_workspace(Community.t(), T.id(), T.id(), User.t() | nil) ::
          T.domain_res(ArticleWorkspace.t())
  def restore_article_workspace(
        %Community{} = community,
        workspace_id,
        snapshot_id,
        _user \\ nil
      ) do
    Transaction.lock_global(Draft.lock_key(community, workspace_id), fn ->
      with {:ok, snapshot} <-
             get_article_workspace_snapshot(community, workspace_id, snapshot_id),
           {:ok, current_draft} <- Draft.read(community, workspace_id),
           {:ok, draft} <-
             Draft.update_unlocked(
               community,
               workspace_id,
               restore_attrs(snapshot, current_draft)
             ),
           {:ok, _} <- trim_snapshots_after_restore(community, draft.id, snapshot) do
        {:ok, draft}
      end
    end)
  end

  @doc """
  Deletes temporary draft checkpoints for one staged draft.

  ## Examples

      iex> Snapshot.clear_article_workspace_checkpoints(community, draft.id)
      {:ok, {3, nil}}
  """
  @spec clear_article_workspace_checkpoints(Community.t(), T.id()) :: T.domain_res(term())
  def clear_article_workspace_checkpoints(%Community{} = community, workspace_id) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.workspace_id == ^workspace_id)
    |> where([r], r.stage == :draft)
    |> ORM.delete_all(:if_exist)
  end

  @doc """
  Deletes later public snapshots for the same published article unless a docs
  release already references them.

  ## Examples

      iex> Snapshot.trim_published_snapshots_after_restore(community, snapshot)
      {:ok, {2, nil}}
  """
  @spec trim_published_snapshots_after_restore(Community.t(), ArticleSnapshot.t()) ::
          T.domain_res(term())
  def trim_published_snapshots_after_restore(
        %Community{} = community,
        %ArticleSnapshot{stage: :public, article_id: article_id} = snapshot
      )
      when not is_nil(article_id) do
    release_snapshot_ids =
      PublishReleaseArticle
      |> where([p], p.article_id == ^article_id)
      |> select([p], p.snapshot_id)

    ArticleSnapshot
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.article_thread == ^snapshot.article_thread)
    |> where([r], r.stage == :public)
    |> where([r], r.article_id == ^article_id)
    |> where([r], is_nil(r.workspace_id))
    |> where([r], r.snapshot_number > ^snapshot.snapshot_number)
    |> where([r], r.id not in subquery(release_snapshot_ids))
    |> ORM.delete_all(:if_exist)
  end

  def trim_published_snapshots_after_restore(_community, _snapshot), do: {:ok, {0, nil}}

  @doc """
  Docs-specific wrapper retained for the existing dashboard GraphQL field.

  ## Examples

      iex> Snapshot.list_doc_draft(community, workspace_id)
      Snapshot.list_article_workspace(community, workspace_id)
  """
  @spec list_doc_draft(Community.t(), T.id(), keyword()) :: T.domain_res([ArticleSnapshot.t()])
  def list_doc_draft(community, workspace_id, opts \\ []),
    do: list_article_workspace(community, workspace_id, opts)

  @doc """
  Docs-specific wrapper around `get_article_workspace_snapshot/3`.
  """
  @spec get_doc_draft_snapshot(Community.t(), T.id(), T.id()) ::
          T.domain_res(ArticleSnapshot.t())
  def get_doc_draft_snapshot(community, workspace_id, snapshot_id),
    do: get_article_workspace_snapshot(community, workspace_id, snapshot_id)

  @doc """
  Docs-specific wrapper around `checkpoint_article_workspace/4`.
  """
  @spec checkpoint_doc_draft(Community.t(), T.id(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleSnapshot.t())
  def checkpoint_doc_draft(community, workspace_id, user \\ nil, opts \\ []),
    do: checkpoint_article_workspace(community, workspace_id, user, opts)

  @doc """
  Docs-specific wrapper around `restore_article_workspace/4`.
  """
  @spec restore_doc_draft(Community.t(), T.id(), T.id(), User.t() | nil) ::
          T.domain_res(ArticleWorkspace.t())
  def restore_doc_draft(community, workspace_id, snapshot_id, user \\ nil),
    do: restore_article_workspace(community, workspace_id, snapshot_id, user)

  @doc """
  Docs-specific wrapper around `clear_article_workspace_checkpoints/2`.
  """
  @spec clear_doc_draft_checkpoints(Community.t(), T.id()) :: T.domain_res(term())
  def clear_doc_draft_checkpoints(community, workspace_id),
    do: clear_article_workspace_checkpoints(community, workspace_id)

  defp read_article_workspace(%Community{} = community, workspace_id) do
    Draft.read(community, workspace_id)
  end

  defp article_workspace_snapshots_query(%ArticleWorkspace{} = draft) do
    query =
      ArticleSnapshot
      |> where([r], r.community_id == ^draft.community_id)
      |> where([r], r.article_thread == ^draft.article_thread)

    case draft.article_id do
      nil ->
        where(query, [r], r.workspace_id == ^draft.id)

      article_id ->
        where(
          query,
          [r],
          r.workspace_id == ^draft.id or
            (r.article_id == ^article_id and r.stage == :public)
        )
    end
  end

  defp maybe_filter_type(query, nil), do: query
  defp maybe_filter_type(query, stage), do: where(query, [r], r.stage == ^stage)

  defp maybe_create_draft_snapshot(%{stage: :draft} = attrs, false) do
    case latest_snapshot(attrs, :draft) do
      %ArticleSnapshot{content_hash: content_hash} = snapshot
      when content_hash == attrs.content_hash ->
        {:ok, snapshot}

      _ ->
        ORM.create(ArticleSnapshot, attrs)
    end
  end

  defp maybe_create_draft_snapshot(attrs, _force?), do: ORM.create(ArticleSnapshot, attrs)

  # Timestamps are for display. The integer chain is the strict order used by
  # restore and diff history so same-second checkpoints still sort correctly.
  defp put_next_snapshot_number(%{} = attrs) do
    Map.put(attrs, :snapshot_number, next_snapshot_number(attrs))
  end

  defp next_snapshot_number(%{} = attrs) do
    ArticleSnapshot
    |> where([r], r.community_id == ^attrs.community_id)
    |> where([r], r.article_thread == ^attrs.article_thread)
    |> where([r], r.stage == ^attrs.stage)
    |> match_snapshot_target(attrs)
    |> select([r], max(r.snapshot_number))
    |> Repo.one()
    |> case do
      nil -> 1
      number -> number + 1
    end
  end

  defp match_snapshot_target(query, %{article_id: article_id}) when not is_nil(article_id) do
    query
    |> where([r], r.article_id == ^article_id)
    |> where([r], is_nil(r.workspace_id))
  end

  defp match_snapshot_target(query, %{workspace_id: workspace_id})
       when not is_nil(workspace_id) do
    query
    |> where([r], r.workspace_id == ^workspace_id)
    |> where([r], is_nil(r.article_id))
  end

  defp match_snapshot_target(query, _attrs), do: query

  defp latest_snapshot(
         %{community_id: community_id, article_thread: article_thread} = attrs,
         stage
       ) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community_id)
    |> where([r], r.article_thread == ^article_thread)
    |> where([r], r.stage == ^stage)
    |> match_snapshot_target(attrs)
    |> order_by([r], desc: r.snapshot_number, desc: r.id)
    |> limit(1)
    |> Repo.one()
  end

  defp trim_snapshots_after_restore(
         %Community{} = community,
         workspace_id,
         %ArticleSnapshot{stage: :draft, workspace_id: workspace_id} = snapshot
       ) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.article_thread == ^snapshot.article_thread)
    |> where([r], r.workspace_id == ^workspace_id)
    |> where([r], r.stage == :draft)
    |> where([r], r.snapshot_number > ^snapshot.snapshot_number)
    |> ORM.delete_all(:if_exist)
  end

  defp trim_snapshots_after_restore(
         %Community{} = community,
         workspace_id,
         %ArticleSnapshot{stage: :public} = snapshot
       ) do
    with {:ok, _} <- trim_published_snapshots_after_restore(community, snapshot) do
      clear_article_workspace_checkpoints(community, workspace_id)
    end
  end

  defp snapshot_attrs_from_article_workspace(
         %Community{} = community,
         %ArticleWorkspace{} = draft,
         stage,
         user
       ) do
    with {:ok, author_id} <- author_id(user) do
      {:ok,
       %{
         community_id: community.id,
         article_thread: draft.article_thread,
         stage: stage,
         workspace_id: draft.id,
         author_id: author_id || draft.author_id,
         title: draft.title,
         slug: draft.slug,
         subtitle: draft.subtitle,
         digest: draft.digest,
         document_json: draft.json,
         content_hash: snapshot_content_hash(draft.content_hash, draft.subtitle),
         schema_version: draft.schema_version || 1
       }}
    end
  end

  defp snapshot_attrs_from_article(article, stage, user) do
    article = Repo.preload(article, [:document, :community])

    with {:ok, article_thread} <- CMS.FrontDesk.thread_of(article),
         {:ok, document} <- require_document(article),
         {:ok, author_id} <- author_id(user) do
      {:ok,
       %{
         community_id: article.community_id,
         article_thread: article_thread,
         stage: stage,
         article_id: article.id,
         author_id: author_id || article.author_id,
         title: article.title,
         slug: Map.get(article, :slug),
         subtitle: Map.get(article, :subtitle),
         digest: article.digest || Map.get(document, :digest),
         document_json: document.json,
         content_hash: snapshot_content_hash(document.content_hash, Map.get(article, :subtitle)),
         schema_version: document.schema_version || 1
       }}
    end
  end

  defp require_document(%{document: %{json: json, content_hash: hash} = document})
       when is_binary(json) and is_binary(hash) do
    {:ok, document}
  end

  defp require_document(_), do: {:error, {:custom, "article snapshot requires document json"}}

  defp author_id(nil), do: {:ok, nil}

  defp author_id(%User{} = user) do
    with {:ok, %Author{id: id}} <- Write.ensure_author_exists(user), do: {:ok, id}
  end

  defp restore_attrs(%ArticleSnapshot{} = snapshot, %ArticleWorkspace{} = draft) do
    %{title: snapshot.title, subtitle: snapshot.subtitle, body: snapshot.document_json}
    |> maybe_put_slug(snapshot.slug || draft.slug)
  end

  defp snapshot_content_hash(content_hash, subtitle) do
    :sha256
    |> :crypto.hash(:erlang.term_to_binary({content_hash, subtitle}))
    |> Base.encode16(case: :lower)
  end

  defp maybe_put_slug(attrs, slug) when is_binary(slug), do: Map.put(attrs, :slug, slug)
  defp maybe_put_slug(attrs, _slug), do: attrs
end
