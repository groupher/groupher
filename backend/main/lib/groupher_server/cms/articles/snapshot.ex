defmodule GroupherServer.CMS.Articles.Snapshot do
  @moduledoc """
  Stores the append-only revision timeline shared by every Article thread.

      branch draft/public head
                |
                | checkpoint / publish / fork / promote / restore
                v
      ArticleSnapshot(revision_number=N)
                |
                +--> Diff compares immutable states
                +--> Restore copies state into a new/current Draft

  Autosave updates the mutable Draft row and does not create a Snapshot. Normal
  checkpoints deduplicate by canonical version hash; explicit lifecycle events
  remain auditable.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Articles.{Branch, Draft, Lock, VersionedRelations, Write}
  alias CMS.Model.{ArticleDocument, ArticleSnapshot, Author, Community}
  alias Helper.{ORM, T}

  require CMS.Const

  @default_limit 30
  @common_snapshot_fields [:title, :digest, :slug, :subtitle]

  @type version_state :: %{
          version_hash: String.t(),
          title: String.t(),
          digest: String.t() | nil,
          slug: String.t() | nil,
          subtitle: String.t() | nil,
          document_json: String.t(),
          body_bag: map(),
          data: map()
        }

  @doc "Lists one Article's branch-local immutable revision timeline."
  @spec list(Community.t(), T.thread(), Ecto.UUID.t(), keyword() | map()) ::
          T.domain_res([ArticleSnapshot.t()])
  def list(%Community{} = community, thread, article_hash_id, opts) do
    with {:ok, branch} <- Branch.resolve(community, thread, opts) do
      ArticleSnapshot
      |> where([snapshot], snapshot.community_id == ^community.id)
      |> where([snapshot], snapshot.thread == ^thread)
      |> where([snapshot], snapshot.branch_id == ^branch.id)
      |> where([snapshot], snapshot.article_hash_id == ^article_hash_id)
      |> maybe_filter_stage(option(opts, :stage))
      |> order_by([snapshot], desc: snapshot.revision_number, desc: snapshot.id)
      |> limit(^option(opts, :limit, @default_limit))
      |> Repo.all()
      |> then(&{:ok, &1})
    end
  end

  @doc "Fetches one Snapshot in an Article's branch-local revision timeline."
  @spec get(Community.t(), T.thread(), Ecto.UUID.t(), Ecto.UUID.t(), keyword() | map()) ::
          T.domain_res(ArticleSnapshot.t())
  def get(%Community{} = community, thread, article_hash_id, snapshot_hash_id, opts) do
    with {:ok, branch} <- Branch.resolve(community, thread, opts) do
      ArticleSnapshot
      |> where([snapshot], snapshot.hash_id == ^snapshot_hash_id)
      |> where([snapshot], snapshot.community_id == ^community.id)
      |> where([snapshot], snapshot.thread == ^thread)
      |> where([snapshot], snapshot.branch_id == ^branch.id)
      |> where([snapshot], snapshot.article_hash_id == ^article_hash_id)
      |> Repo.one()
      |> case do
        %ArticleSnapshot{} = snapshot -> {:ok, snapshot}
        nil -> {:error, {:not_exist, "Article Snapshot #{snapshot_hash_id}"}}
      end
    end
  end

  @doc "Creates or reuses a deduplicated checkpoint of the current Draft."
  @spec checkpoint(Community.t(), T.thread(), Ecto.UUID.t(), User.t() | nil, keyword() | map()) ::
          T.domain_res(ArticleSnapshot.t())
  def checkpoint(%Community{} = community, thread, article_hash_id, user, opts) do
    Lock.run(community, thread, article_hash_id, fn ->
      with {:ok, draft} <- Draft.read(community, thread, article_hash_id, opts) do
        checkpoint_article(draft, CMS.Const.article_snapshot_action(:checkpoint), user, opts)
      end
    end)
  end

  @doc "Creates an immutable Snapshot from a current Article row."
  @spec checkpoint_article(T.article(), atom(), User.t() | nil, keyword() | map()) ::
          T.domain_res(ArticleSnapshot.t())
  def checkpoint_article(article, action, user, opts \\ []) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
         {:ok, document} <-
           ORM.find_by(ArticleDocument, article_id: article.id, thread: thread),
         {:ok, author_id} <- author_id(user, article),
         {:ok, attrs} <- snapshot_attrs(article, document, thread, action, author_id, opts) do
      maybe_create_snapshot(attrs, action)
    end
  end

  @doc "Builds the current comparable Article state without creating a Snapshot row."
  @spec current_state(T.article()) :: T.domain_res(version_state())
  def current_state(article) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(article),
         {:ok, document} <-
           ORM.find_by(ArticleDocument, article_id: article.id, thread: thread),
         {:ok, body_bag} <- BodyBag.from_document(document) do
      {:ok, version_state(article, document, body_bag)}
    end
  end

  @doc """
  Restores one historical Snapshot into the target branch Draft.

  Restore is append-only: later history remains, and the restored Draft receives
  a new `restore` Snapshot referencing the selected source.
  """
  @spec restore(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          Ecto.UUID.t(),
          User.t() | nil,
          keyword() | map()
        ) :: T.domain_res(T.article())
  def restore(
        %Community{} = community,
        thread,
        article_hash_id,
        snapshot_hash_id,
        user,
        opts
      ) do
    Lock.run(community, thread, article_hash_id, fn ->
      with {:ok, source_snapshot} <-
             get(community, thread, article_hash_id, snapshot_hash_id, opts),
           {:ok, draft} <- restore_into_draft(community, thread, source_snapshot, user, opts),
           {:ok, _restore_snapshot} <-
             checkpoint_article(
               draft,
               CMS.Const.article_snapshot_action(:restore),
               user,
               source_snapshot_id: source_snapshot.id
             ) do
        {:ok, draft}
      end
    end)
  end

  defp snapshot_attrs(article, document, thread, action, author_id, opts) do
    branch_id = article.branch_id
    article_hash_id = article.article_hash_id
    version_data = version_data(article)
    version_hash = CMS.Hash.article_version_hash(article, document.body_hash, version_data)
    parent_snapshot = latest_snapshot(thread, branch_id, article_hash_id)

    with {:ok, body_bag} <- BodyBag.from_document(document) do
      {:ok,
       %{
         community_id: article.community_id,
         branch_id: branch_id,
         article_hash_id: article_hash_id,
         thread: thread,
         stage: article.stage,
         action: action,
         parent_snapshot_id: parent_snapshot && parent_snapshot.id,
         source_snapshot_id: option(opts, :source_snapshot_id),
         author_id: author_id,
         title: article.title,
         slug: Map.get(article, :slug),
         subtitle: Map.get(article, :subtitle),
         digest: article.digest,
         document_json: document.json,
         body_bag: BodyBag.to_map(body_bag),
         data: version_data,
         version_hash: version_hash,
         revision_number: next_revision_number(thread, branch_id, article_hash_id),
         schema_version: document.schema_version || Map.get(article, :schema_version) || 1,
         message: option(opts, :message)
       }}
    end
  end

  defp version_state(article, document, body_bag) do
    data = version_data(article)

    %{
      version_hash: CMS.Hash.article_version_hash(article, document.body_hash, data),
      title: article.title,
      digest: article.digest,
      slug: Map.get(article, :slug),
      subtitle: Map.get(article, :subtitle),
      document_json: document.json,
      body_bag: BodyBag.to_map(body_bag),
      data: data
    }
  end

  @doc "Computes the comparable current version hash from a persisted Article row."
  @spec version_hash(T.article()) :: String.t()
  def version_hash(article) do
    CMS.Hash.article_version_hash(article, article.body_hash, version_data(article))
  end

  defp version_data(article) do
    scalar_data =
      article
      |> Map.from_struct()
      |> Map.take(article.__struct__.version_fields())
      |> Map.drop(@common_snapshot_fields ++ [:json])

    Map.merge(scalar_data, VersionedRelations.snapshot_data(article))
  end

  defp maybe_create_snapshot(attrs, action)
       when action == CMS.Const.article_snapshot_action(:checkpoint) do
    case latest_snapshot(attrs.thread, attrs.branch_id, attrs.article_hash_id) do
      %ArticleSnapshot{version_hash: version_hash} = snapshot
      when version_hash == attrs.version_hash ->
        {:ok, snapshot}

      _ ->
        ORM.create(ArticleSnapshot, attrs)
    end
  end

  defp maybe_create_snapshot(attrs, _action), do: ORM.create(ArticleSnapshot, attrs)

  defp latest_snapshot(thread, branch_id, article_hash_id) do
    ArticleSnapshot
    |> where([snapshot], snapshot.thread == ^thread)
    |> where([snapshot], snapshot.branch_id == ^branch_id)
    |> where([snapshot], snapshot.article_hash_id == ^article_hash_id)
    |> order_by([snapshot], desc: snapshot.revision_number, desc: snapshot.id)
    |> limit(1)
    |> Repo.one()
  end

  defp next_revision_number(thread, branch_id, article_hash_id) do
    case latest_snapshot(thread, branch_id, article_hash_id) do
      nil -> 1
      snapshot -> snapshot.revision_number + 1
    end
  end

  defp restore_into_draft(community, thread, snapshot, user, opts) do
    case Draft.read(community, thread, snapshot.article_hash_id, opts) do
      {:ok, _draft} ->
        with {:ok, draft} <-
               Draft.update_unlocked(
                 community,
                 thread,
                 snapshot.article_hash_id,
                 restore_attrs(snapshot, opts)
               ) do
          VersionedRelations.restore(draft, snapshot.data)
        end

      {:error, _} ->
        create_restored_draft(community, thread, snapshot, user, opts)
    end
  end

  defp create_restored_draft(_community, _thread, _snapshot, nil, _opts) do
    {:error, {:custom, "Article Snapshot restore requires a user to create a Draft"}}
  end

  defp create_restored_draft(community, thread, snapshot, %User{} = user, opts) do
    with {:ok, branch} <- Branch.resolve(community, thread, opts) do
      snapshot
      |> restore_attrs(branch_id: branch.id)
      |> Map.drop([:cover_url, :cover_url_dark])
      |> Map.put(:article_hash_id, snapshot.article_hash_id)
      |> then(&Draft.create(community, thread, &1, user))
      |> case do
        {:ok, draft} -> VersionedRelations.restore(draft, snapshot.data)
        error -> error
      end
    end
  end

  defp restore_attrs(snapshot, opts) do
    snapshot.data
    |> atomize_keys()
    |> Map.drop([:cover_url, :cover_url_dark])
    |> Map.merge(%{
      title: snapshot.title,
      digest: snapshot.digest,
      body_bag: snapshot.body_bag
    })
    |> maybe_put(:slug, snapshot.slug)
    |> maybe_put(:subtitle, snapshot.subtitle)
    |> maybe_put(:branch_id, option(opts, :branch_id))
  end

  defp atomize_keys(map) when is_map(map) do
    Map.new(map, fn
      {key, value} when is_binary(key) -> {String.to_existing_atom(key), value}
      pair -> pair
    end)
  end

  defp maybe_put(map, _key, nil), do: map
  defp maybe_put(map, key, value), do: Map.put(map, key, value)

  defp author_id(nil, article), do: {:ok, article.author_id}

  defp author_id(%User{} = user, _article) do
    with {:ok, %Author{id: id}} <- Write.ensure_author_exists(user), do: {:ok, id}
  end

  defp maybe_filter_stage(query, nil), do: query
  defp maybe_filter_stage(query, stage), do: where(query, [snapshot], snapshot.stage == ^stage)

  defp option(opts, key, default \\ nil)
  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)

  defp option(opts, key, default) when is_map(opts) do
    Map.get(opts, key) || Map.get(opts, Atom.to_string(key)) || default
  end
end
