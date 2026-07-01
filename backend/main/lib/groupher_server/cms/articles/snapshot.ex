defmodule GroupherServer.CMS.Articles.Snapshot do
  @moduledoc """
  Version history service for Groupher doc content.

  This module owns the common draft/public snapshot chain for article
  threads. It intentionally stays article-scoped: comments are frontend-only for
  now and should not share this table or service.

      Doc(thread=post/doc/changelog/blog)
          |
          | checkpoint_doc_draft/4
          v
      ArticleSnapshot(stage=draft, doc_id=doc.doc_id)
          |
          | publish_doc_draft/3
          v
      Doc(stage=public)
          |
          +--> ArticleSnapshot(stage=public, doc_id=doc.doc_id)
          +--> clear ArticleSnapshot(stage=draft, doc_id=doc.doc_id)

  Restore keeps the product model linear instead of git-like. Restoring a draft
  checkpoint deletes later draft checkpoints. Restoring a public snapshot hides
  later public snapshots from the doc history when possible, but preserves
  any immutable snapshot already referenced by a docs publish release.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Articles.{Draft, Write}
  alias CMS.Model.{Doc, ArticleSnapshot, Author, Community, PublishReleaseArticle}
  alias Helper.{ORM, T, Transaction}

  require CMS.Const

  @default_limit 30

  @doc """
  Lists snapshot history visible from one staged doc version.

  Draft and public snapshots are matched by `doc_id`.

  ## Examples

      iex> Snapshot.list_doc_draft(community, doc.doc_id, stage: CMS.Const.stage(:draft))
      {:ok, [%ArticleSnapshot{stage: CMS.Const.stage(:draft)}]}

      iex> Snapshot.list_doc_draft(community, doc.doc_id, stage: CMS.Const.stage(:public), limit: 5)
      {:ok, [%ArticleSnapshot{stage: CMS.Const.stage(:public)}]}
  """
  @spec list_doc_draft(Community.t(), String.t(), keyword()) ::
          T.domain_res([ArticleSnapshot.t()])
  def list_doc_draft(%Community{} = community, doc_id, opts \\ []) do
    community
    |> doc_snapshots_query(doc_id)
    |> maybe_filter_stage(Keyword.get(opts, :stage))
    |> order_by([r], desc: r.snapshot_number, desc: r.id)
    |> limit(^Keyword.get(opts, :limit, @default_limit))
    |> Repo.all()
    |> then(&{:ok, &1})
  end

  @doc """
  Fetches one snapshot that belongs to the staged draft chain.

  ## Examples

      iex> Snapshot.get_doc_draft_snapshot(community, doc.doc_id, snapshot.id)
      {:ok, %ArticleSnapshot{}}
  """
  @spec get_doc_draft_snapshot(Community.t(), String.t(), T.id()) ::
          T.domain_res(ArticleSnapshot.t())
  def get_doc_draft_snapshot(%Community{} = community, doc_id, snapshot_id) do
    community
    |> doc_snapshots_query(doc_id)
    |> where([r], r.id == ^snapshot_id)
    |> Repo.one()
    |> case do
      %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
      nil -> {:error, {:not_exist, "article snapshot #{snapshot_id}"}}
    end
  end

  @doc """
  Creates a draft checkpoint from the current staged content.

  Unchanged draft checkpoints are skipped by comparing the latest checkpoint's
  `content_hash`. Pass `force: true` only for explicit product events that must
  be materialized.

  ## Examples

      iex> Snapshot.checkpoint_doc_draft(community, doc.doc_id, user)
      {:ok, %ArticleSnapshot{stage: CMS.Const.stage(:draft), doc_id: doc.doc_id}}
  """
  @spec checkpoint_doc_draft(Community.t(), String.t(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleSnapshot.t())
  def checkpoint_doc_draft(
        %Community{} = community,
        doc_id,
        user \\ nil,
        opts \\ []
      ) do
    stage = Keyword.get(opts, :stage, CMS.Const.stage(:draft))
    force? = Keyword.get(opts, :force, false)

    with {:ok, draft} <- read_doc_draft(community, doc_id),
         {:ok, attrs} <- snapshot_attrs_from_doc(draft, stage, user) do
      attrs
      |> put_next_snapshot_number()
      |> maybe_create_draft_snapshot(force?)
    end
  end

  @doc """
  Saves a published doc snapshot.

  Published snapshots are not deduplicated. A publish is a product event, so two
  publishes with equal content should still produce two public snapshot rows.

  ## Examples

      iex> Snapshot.checkpoint_published(doc, user)
      {:ok, %ArticleSnapshot{stage: CMS.Const.stage(:public), thread: :doc}}
  """
  @spec checkpoint_published(Doc.t(), User.t() | nil, keyword()) ::
          T.domain_res(ArticleSnapshot.t())
  def checkpoint_published(%Doc{} = doc, user \\ nil, opts \\ []) do
    stage = Keyword.get(opts, :stage, CMS.Const.stage(:public))

    with {:ok, attrs} <- snapshot_attrs_from_doc(doc, stage, user) do
      attrs
      |> put_next_snapshot_number()
      |> then(&ORM.create(ArticleSnapshot, &1))
    end
  end

  @doc """
  Publishes a staged draft and records the public snapshot.

  The draft is published through `CMS.Articles.Draft.publish/3`. After the
  public snapshot is recorded, draft checkpoints are deleted because they no
  longer represent unpublished work.

  ## Examples

      iex> Snapshot.publish_doc_draft(community, doc.doc_id, user)
      {:ok, %ArticleSnapshot{stage: CMS.Const.stage(:public)}}
  """
  @spec publish_doc_draft(Community.t(), String.t(), User.t()) ::
          T.domain_res(ArticleSnapshot.t())
  def publish_doc_draft(%Community{} = community, doc_id, %User{} = user) do
    Transaction.lock_global(Draft.lock_key(community, doc_id), fn ->
      with {:ok, doc} <- Draft.publish_unlocked(community, doc_id, user),
           {:ok, snapshot} <- checkpoint_published(doc, user),
           {:ok, _} <- clear_doc_draft_checkpoints(community, doc_id) do
        {:ok, snapshot}
      end
    end)
  end

  @doc """
  Restores a snapshot into the staged draft.

  Draft restore trims later draft checkpoints. Published restore trims later
  public snapshots for that doc and clears staged checkpoints, keeping
  both tabs in a single linear timeline.

  ## Examples

      iex> Snapshot.restore_doc_draft(community, doc.doc_id, snapshot.id, user)
      {:ok, %Doc{}}
  """
  @spec restore_doc_draft(Community.t(), String.t(), T.id(), User.t() | nil) ::
          T.domain_res(Doc.t())
  def restore_doc_draft(
        %Community{} = community,
        doc_id,
        snapshot_id,
        user \\ nil
      ) do
    Transaction.lock_global(Draft.lock_key(community, doc_id), fn ->
      with {:ok, snapshot} <-
             get_doc_draft_snapshot(community, doc_id, snapshot_id),
           {:ok, draft} <- restore_snapshot_into_draft(community, doc_id, snapshot, user),
           {:ok, _} <- trim_snapshots_after_restore(community, doc_id, snapshot) do
        {:ok, draft}
      end
    end)
  end

  @doc """
  Deletes temporary draft checkpoints for one staged draft.

  ## Examples

      iex> Snapshot.clear_doc_draft_checkpoints(community, doc.doc_id)
      {:ok, {3, nil}}
  """
  @spec clear_doc_draft_checkpoints(Community.t(), String.t()) :: T.domain_res(term())
  def clear_doc_draft_checkpoints(%Community{} = community, doc_id) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.doc_id == ^doc_id)
    |> where([r], r.stage == CMS.Const.stage(:draft))
    |> ORM.delete_all(:if_exist)
  end

  @doc """
  Deletes later public snapshots for the same doc unless a docs
  release already references them.

  ## Examples

      iex> Snapshot.trim_published_snapshots_after_restore(community, snapshot)
      {:ok, {2, nil}}
  """
  @spec trim_published_snapshots_after_restore(Community.t(), ArticleSnapshot.t()) ::
          T.domain_res(term())
  def trim_published_snapshots_after_restore(
        %Community{} = community,
        %ArticleSnapshot{stage: CMS.Const.stage(:public), doc_id: doc_id} = snapshot
      )
      when not is_nil(doc_id) do
    release_snapshot_ids =
      PublishReleaseArticle
      |> where([p], p.doc_id == ^doc_id)
      |> select([p], p.snapshot_id)

    ArticleSnapshot
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.thread == ^snapshot.thread)
    |> where([r], r.stage == CMS.Const.stage(:public))
    |> where([r], r.doc_id == ^doc_id)
    |> where([r], r.stage == CMS.Const.stage(:public))
    |> where([r], r.snapshot_number > ^snapshot.snapshot_number)
    |> where([r], r.id not in subquery(release_snapshot_ids))
    |> ORM.delete_all(:if_exist)
  end

  def trim_published_snapshots_after_restore(_community, _snapshot), do: {:ok, {0, nil}}

  defp read_doc_draft(%Community{} = community, doc_id) do
    Draft.read(community, doc_id)
  end

  defp doc_snapshots_query(%Community{} = community, doc_id) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.thread == ^:doc)
    |> where([r], r.doc_id == ^doc_id)
  end

  defp maybe_filter_stage(query, nil), do: query
  defp maybe_filter_stage(query, stage), do: where(query, [r], r.stage == ^stage)

  defp maybe_create_draft_snapshot(%{stage: CMS.Const.stage(:draft)} = attrs, false) do
    case latest_snapshot(attrs, :draft) do
      %ArticleSnapshot{content_hash: content_hash} = snapshot
      when content_hash == attrs.content_hash ->
        {:ok, snapshot}

      _ ->
        ORM.create(ArticleSnapshot, attrs)
    end
  end

  defp maybe_create_draft_snapshot(attrs, _force?), do: ORM.create(ArticleSnapshot, attrs)

  defp put_next_snapshot_number(%{} = attrs) do
    Map.put(attrs, :snapshot_number, next_snapshot_number(attrs))
  end

  defp next_snapshot_number(%{} = attrs) do
    ArticleSnapshot
    |> where([r], r.community_id == ^attrs.community_id)
    |> where([r], r.thread == ^attrs.thread)
    |> where([r], r.stage == ^attrs.stage)
    |> match_snapshot_target(attrs)
    |> select([r], max(r.snapshot_number))
    |> Repo.one()
    |> case do
      nil -> 1
      number -> number + 1
    end
  end

  defp match_snapshot_target(query, %{doc_id: doc_id}) when not is_nil(doc_id) do
    where(query, [r], r.doc_id == ^doc_id)
  end

  defp match_snapshot_target(query, _attrs), do: query

  defp latest_snapshot(
         %{community_id: community_id, thread: thread} = attrs,
         stage
       ) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community_id)
    |> where([r], r.thread == ^thread)
    |> where([r], r.stage == ^stage)
    |> match_snapshot_target(attrs)
    |> order_by([r], desc: r.snapshot_number, desc: r.id)
    |> limit(1)
    |> Repo.one()
  end

  defp trim_snapshots_after_restore(
         %Community{} = community,
         doc_id,
         %ArticleSnapshot{stage: CMS.Const.stage(:draft), doc_id: doc_id} = snapshot
       ) do
    ArticleSnapshot
    |> where([r], r.community_id == ^community.id)
    |> where([r], r.thread == ^snapshot.thread)
    |> where([r], r.doc_id == ^doc_id)
    |> where([r], r.stage == CMS.Const.stage(:draft))
    |> where([r], r.snapshot_number > ^snapshot.snapshot_number)
    |> ORM.delete_all(:if_exist)
  end

  defp trim_snapshots_after_restore(
         %Community{} = community,
         doc_id,
         %ArticleSnapshot{stage: CMS.Const.stage(:public)} = snapshot
       ) do
    with {:ok, _} <- trim_published_snapshots_after_restore(community, snapshot) do
      clear_doc_draft_checkpoints(community, doc_id)
    end
  end

  defp snapshot_attrs_from_doc(%Doc{} = doc, stage, user) do
    with {:ok, author_id} <- author_id(user) do
      {:ok,
       %{
         community_id: doc.community_id,
         thread: :doc,
         stage: stage,
         doc_id: doc.doc_id,
         author_id: author_id || doc.author_id,
         title: doc.title,
         slug: doc.slug,
         subtitle: doc.subtitle,
         digest: doc.digest,
         document_json: doc.json,
         content_hash: snapshot_content_hash(doc.content_hash, doc.subtitle),
         schema_version: doc.schema_version || 1
       }}
    end
  end

  defp author_id(nil), do: {:ok, nil}

  defp author_id(%User{} = user) do
    with {:ok, %Author{id: id}} <- Write.ensure_author_exists(user), do: {:ok, id}
  end

  defp restore_snapshot_into_draft(%Community{} = community, doc_id, snapshot, user) do
    case Draft.read(community, doc_id) do
      {:ok, current_draft} ->
        Draft.update_unlocked(community, doc_id, restore_attrs(snapshot, current_draft))

      {:error, _} ->
        create_restored_draft(community, doc_id, snapshot, user)
    end
  end

  defp create_restored_draft(
         %Community{} = community,
         doc_id,
         %ArticleSnapshot{} = snapshot,
         %User{} = user
       ) do
    attrs =
      snapshot
      |> restore_attrs(%Doc{slug: snapshot.slug})
      |> Map.put(:doc_id, doc_id)

    Draft.create(community, :doc, attrs, user)
  end

  defp create_restored_draft(_community, _doc_id, _snapshot, _user) do
    {:error, {:custom, "doc draft restore requires user"}}
  end

  defp restore_attrs(%ArticleSnapshot{} = snapshot, %Doc{} = draft) do
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
