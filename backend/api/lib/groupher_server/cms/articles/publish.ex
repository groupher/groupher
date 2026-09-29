defmodule GroupherServer.CMS.Articles.Publish do
  @moduledoc """
  Owns the only transition from a main Draft to the permanent public runtime row.

      first publish                    republish

      main/draft                       main/public + main/draft
           |                                      |
           | promote row                          | copy versioned fields
           v                                      v
      main/public                       same main/public physical row
           |                                      |
           +-- initialize runtime                 +-- preserve runtime
           +-- Doc: append DocSnapshot             +-- Doc: append DocSnapshot
           +-- Article: no Snapshot               +-- Article: no Snapshot

  Ordinary Articles have no branch dimension and use the persistent Draft path.
  Docs branches may publish inside Dashboard; their public projection
  and release remain branch-local and are never used by the public main scope.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Publish
        -> Repo / domain event
  """

  require GroupherServer.CMS.Docs.Const
  require GroupherServer.CMS.Const

  import Helper.Utils, only: [plural: 1]
  import Ecto.Query

  alias GroupherServer.{Accounts, Activity, CMS, PublicCache, Repo}
  alias CMS.{Articles, ErrorCat}
  alias Accounts.Model.User
  alias CMS.Artiment.BodyBag

  alias CMS.Articles.{
    Document,
    Draft,
    MutationLock,
    States,
    VersionedRelations,
    Write
  }

  alias CMS.Articles.Lifecycle, as: ArticleLifecycleService
  alias CMS.Docs.{Branch, Snapshot}
  alias CMS.Docs.Lifecycle, as: DocLifecycle
  alias Ecto.Multi
  alias CMS.{Assets, Communities, Events, Gate}
  alias CMS.Gate.Decision
  alias CMS.Gate.RateLimit.Publish, as: PublishRateLimit
  alias CMS.Model.{ArticleDocument, ArticleLifecycle, Author, Community, DocSnapshot}
  alias CMS.SearchArtiments.Indexer
  alias Helper.{ContentThumbnail, Later, ORM, T, Transaction}
  alias Helper.Validator.Slug
  alias PublicCache.Const, as: PublicCacheConst

  @doc "Creates a main Draft and publishes it atomically for direct-publish products."
  @spec create(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    article_hash_id = Map.get(attrs, :article_hash_id) || Ecto.UUID.generate()
    attrs = Map.put(attrs, :article_hash_id, article_hash_id)

    run_locked(community, thread, article_hash_id, attrs, fn ->
      with {:ok, _draft} <- Draft.create(community, thread, attrs, user),
           {:ok, %{article: public_article}} <-
             do_publish(community, thread, article_hash_id, user, attrs) do
        {:ok, public_article}
      end
    end)
  end

  @doc "Starts or updates a persistent Draft while leaving the Public head unchanged."
  @spec update(T.article(), map(), User.t() | nil) :: T.domain_res(T.article())
  def update(public_article, attrs, user \\ nil)

  def update(public_article, attrs, user) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(public_article),
         %Community{} = community <- Repo.get(Community, public_article.community_id),
         {:ok, user} <- publish_actor(public_article, user) do
      run_locked(
        community,
        thread,
        public_article.article_hash_id,
        nil,
        fn ->
          with {:ok, canonical_article} <- Gate.access_check(user, :edit, public_article),
               {:ok, draft} <-
                 Draft.ensure_from_public_unlocked(
                   community,
                   thread,
                   public_article.article_hash_id,
                   nil,
                   user
                 ),
               attrs <- Map.put_new(attrs, :expected_version, draft.version),
               {:ok, updated_draft} <-
                 Draft.update_unlocked(
                   community,
                   thread,
                   public_article.article_hash_id,
                   attrs,
                   require_version?: true
                 ),
               {:ok, _public_article} <- States.update_edit_status(canonical_article),
               {:ok, updated_draft} <- States.update_edit_status(updated_draft) do
            {:ok, updated_draft}
          else
            {:error, %Decision{} = decision} -> {:error, Decision.primary_error(decision)}
            error -> error
          end
        end
      )
    else
      nil -> {:error, CMS.Articles.ErrorCat.not_exist("Article Community")}
      error -> error
    end
  end

  @doc "Publishes one Draft and returns its public Article plus a DocSnapshot only for Doc targets."
  @spec publish(Community.t(), T.thread(), Ecto.UUID.t(), User.t(), map() | keyword()) ::
          T.domain_res(%{article: T.article(), snapshot: DocSnapshot.t() | nil})
  def publish(%Community{} = community, thread, article_hash_id, %User{} = user, branch_ref) do
    run_locked(community, thread, article_hash_id, branch_ref, fn ->
      do_publish(community, thread, article_hash_id, user, branch_ref)
    end)
  end

  defp run_locked(%Community{} = community, :doc, article_hash_id, branch_ref, fun) do
    with {:ok, branch} <- Branch.resolve(community, branch_ref) do
      MutationLock.with_article(community, :doc, branch.id, article_hash_id, fun)
    end
  end

  defp run_locked(%Community{} = community, thread, article_hash_id, _branch_ref, fun) do
    MutationLock.with_article(community, thread, article_hash_id, fun)
  end

  defp do_publish(%Community{} = community, thread, article_hash_id, %User{} = user, branch_ref) do
    operation_ref = Ecto.UUID.generate()

    with {:ok, branch} <- resolve_branch(community, thread, branch_ref),
         :ok <- validate_publish_branch(thread, branch),
         {:ok, draft} <- Draft.read(community, thread, article_hash_id, branch),
         :ok <- ensure_expected_version(draft, branch_ref),
         {:ok, canonical_draft} <- Gate.access_check(user, :publish, draft),
         :ok <- validate_version(canonical_draft),
         restored_publish? <- thread == :doc and Snapshot.restored_draft?(canonical_draft),
         previous <- previous_public(community, thread, branch, canonical_draft),
         {:ok, public_article, first_publish?} <-
           apply_draft(community, thread, branch, canonical_draft),
         {:ok, lifecycle} <-
           transition_lifecycle(
             community,
             thread,
             canonical_draft,
             branch,
             :published,
             branch_ref
           ),
         {:ok, public_article} <- put_public_thumbnail(public_article, thread),
         {:ok, public_article} <-
           maybe_finalize_first_publish(
             community,
             thread,
             public_article,
             user,
             first_publish?
           ),
         {:ok, snapshot} <- maybe_snapshot(thread, public_article, user),
         :ok <-
           record_publish_activity(
             thread,
             previous,
             public_article,
             user,
             first_publish?,
             restored_publish?,
             snapshot,
             operation_ref,
             lifecycle.changed_at
           ),
         :ok <-
           run_after_publish(community, thread, public_article, first_publish?, operation_ref) do
      {:ok, %{article: public_article, snapshot: snapshot}}
    else
      {:error, %Decision{} = decision} -> {:error, Decision.primary_error(decision)}
      error -> error
    end
  end

  defp previous_public(community, :doc, branch, draft),
    do: unwrap_previous(Draft.read_branch_public(community, :doc, draft.article_hash_id, branch))

  defp previous_public(community, thread, _branch, draft),
    do: unwrap_previous(Draft.read_public(community, thread, draft.article_hash_id, nil))

  defp unwrap_previous({:ok, article}), do: article
  defp unwrap_previous({:error, _}), do: nil

  defp record_publish_activity(
         thread,
         previous,
         article,
         user,
         first_publish?,
         restored_publish?,
         snapshot,
         operation_ref,
         occurred_at
       ) do
    events =
      []
      |> maybe_add_created(first_publish?)
      |> maybe_add_title_change(previous, article)
      |> maybe_add_body_change(previous, article)
      |> maybe_add_publish(thread, snapshot, restored_publish?)

    Enum.reduce_while(events, :ok, fn {action, changes, metadata}, :ok ->
      case Activity.log(article, action,
             actor: user,
             operation_ref: operation_ref,
             occurred_at: occurred_at,
             payload: changes,
             changed_fields: Map.keys(changes),
             metadata: metadata
           ) do
        {:ok, _log} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp maybe_add_created(events, true), do: events ++ [{:created, %{}, %{}}]
  defp maybe_add_created(events, false), do: events

  defp maybe_add_title_change(events, nil, _article), do: events

  defp maybe_add_title_change(events, previous, article) do
    if previous.title == article.title,
      do: events,
      else: events ++ [{:title_changed, %{title: article.title}, %{}}]
  end

  defp maybe_add_body_change(events, nil, _article), do: events

  defp maybe_add_body_change(events, previous, article) do
    if previous.body_hash == article.body_hash do
      events
    else
      events ++
        [
          {:body_updated, %{body_hash: article.body_hash, schema_version: article.schema_version},
           %{}}
        ]
    end
  end

  defp maybe_add_publish(events, :doc, snapshot, restored_publish?) do
    snapshot_ref = if snapshot, do: Map.get(snapshot, :hash_id), else: nil
    action = if restored_publish?, do: :publish_restored, else: :published
    events ++ [{action, %{}, %{snapshot_ref: snapshot_ref} |> compact()}]
  end

  defp maybe_add_publish(events, :changelog, _snapshot, _restored_publish?),
    do: events ++ [{:released, %{}, %{}}]

  defp maybe_add_publish(events, _thread, _snapshot, _restored_publish?), do: events

  defp compact(map),
    do: map |> Enum.reject(fn {_key, value} -> is_nil(value) end) |> Map.new()

  defp validate_publish_branch(:doc, _branch), do: :ok

  defp validate_publish_branch(_thread, branch) do
    if is_nil(branch),
      do: :ok,
      else: {:error, ErrorCat.custom("ordinary Articles have no branch")}
  end

  defp apply_draft(%Community{} = community, thread, branch, draft) do
    public_result =
      if thread == :doc do
        Draft.read_branch_public(community, thread, draft.article_hash_id, branch)
      else
        Draft.read_public(community, thread, draft.article_hash_id, nil)
      end

    case public_result do
      {:ok, public_article} -> publish_over_existing(thread, draft, public_article)
      {:error, _} -> publish_first(draft)
    end
  end

  defp publish_first(draft) do
    draft
    |> ORM.update(%{
      stage: CMS.Const.stage(:public),
      active_at: draft.inserted_at || DateTime.utc_now(:second)
    })
    |> case do
      {:ok, public_article} -> {:ok, public_article, true}
      error -> error
    end
  end

  defp publish_over_existing(thread, draft, public_article) do
    with {:ok, draft_document} <-
           ORM.find_by(ArticleDocument, article_id: draft.id, thread: thread) do
      version_attrs =
        draft
        |> Map.from_struct()
        |> Map.take(draft.__struct__.version_fields() ++ [:body_hash, :schema_version])

      Multi.new()
      |> Multi.run(:public_relations, fn _, _ ->
        community = Repo.get!(Community, draft.community_id)
        VersionedRelations.publish(community, thread, draft, public_article)
      end)
      |> Multi.run(:public_article, fn _, %{public_relations: public_article} ->
        ORM.update(public_article, version_attrs)
      end)
      |> Multi.run(:public_document, fn _, %{public_article: public_article} ->
        Document.update(public_article, %{body_bag: BodyBag.from_document_map(draft_document)})
      end)
      |> Multi.run(:public_edit_status, fn _, %{public_article: public_article} ->
        States.update_edit_status(public_article)
      end)
      |> Multi.run(:public_asset_refs, fn _, %{public_article: public_article} ->
        Assets.copy_refs(draft, public_article)
      end)
      |> Multi.run(:remove_draft, fn _, _ -> ORM.delete(draft) end)
      |> Multi.run(:remove_draft_document, fn _, _ -> Document.remove(thread, draft.id) end)
      |> Multi.run(:remove_draft_cover, fn _, _ ->
        VersionedRelations.delete_owned_cover(draft)
      end)
      |> Repo.transaction()
      |> case do
        {:ok, %{public_edit_status: public_article}} -> {:ok, public_article, false}
        {:error, _step, reason, _changes} -> {:error, reason}
      end
    end
  end

  defp put_public_thumbnail(public_article, thread) do
    with {:ok, document} <-
           ORM.find_by(ArticleDocument, article_id: public_article.id, thread: thread),
         {:ok, _document} <-
           ORM.update(document, %{thumbnail: ContentThumbnail.compile_json(document.json)}) do
      {:ok, public_article}
    end
  end

  defp maybe_finalize_first_publish(
         _community,
         _thread,
         public_article,
         _user,
         false
       ),
       do: {:ok, public_article}

  defp maybe_finalize_first_publish(
         %Community{} = community,
         thread,
         public_article,
         %User{} = user,
         true
       ) do
    Transaction.lock_row(community, fn locked_community ->
      finalize_first_publish(locked_community, thread, public_article, user)
    end)
  end

  defp finalize_first_publish(
         %Community{} = community,
         thread,
         public_article,
         %User{} = user
       ) do
    with {:ok, community} <- ORM.fill_meta(community),
         inner_id <- next_inner_id(community, thread),
         {:ok, public_article} <- ORM.update(public_article, %{inner_id: inner_id}),
         {:ok, public_article} <- States.mirror(community, public_article),
         {:ok, :pass} <- VersionedRelations.activate_first_publish(public_article),
         {:ok, community} <- Communities.update_count_field(community, thread),
         {:ok, _community} <- Communities.update_inner_id(community, thread, public_article),
         {:ok, _states} <- Accounts.Publish.update_states(user, thread),
         {:ok, _action} <- PublishRateLimit.record(user) do
      {:ok, public_article}
    end
  end

  defp run_after_publish(community, thread, public_article, first_publish?, operation_ref) do
    :ok = CMS.ArticleStats.initialize(public_article)
    Indexer.enqueue_upsert(public_article)
    Later.run({CMS.Press, :invalidate, [public_article.community_id]})
    Later.run({Events, :emit, [:sync_mentions, %{artiment: public_article}]})
    Later.run({Events, :emit, [:audition, %{artiment: public_article}]})

    invalidation_type =
      if first_publish?,
        do: PublicCacheConst.article_published(),
        else: PublicCacheConst.article_content_changed()

    {:ok, _invalidation} =
      PublicCache.invalidate_now(
        invalidation_type,
        %{
          community: community.slug,
          community_id: community.id,
          thread: thread,
          inner_id: public_article.inner_id,
          id: public_article.id
        },
        causation_id: operation_ref,
        aggregate_type: "article"
      )

    if first_publish? do
      # Keep the durable job payload to stable identity; the notification
      # worker reloads the current Article authority when it executes.
      Later.run(
        {Write, :notify_admin_new_article,
         [%{target: public_article.__struct__, id: public_article.id}]}
      )
    end

    :ok
  end

  defp publish_actor(_article, %User{} = user), do: {:ok, user}

  defp publish_actor(article, nil) do
    with {:ok, author} <- ORM.find(Author, article.author_id, preload: :user) do
      {:ok, author.user}
    end
  end

  defp next_inner_id(community, thread) do
    field = :"#{plural(thread)}_inner_id_index"
    (Map.get(community.meta, field) || 0) + 1
  end

  defp validate_version(%{slug: slug}) when is_binary(slug) do
    if Slug.valid?(slug),
      do: :ok,
      else: {:error, ErrorCat.custom("Article slug is invalid")}
  end

  defp validate_version(_article), do: :ok

  defp ensure_expected_version(%{version: version}, opts) when is_map(opts) do
    required? = Map.get(opts, :require_expected_version, false)

    case Map.fetch(opts, :expected_version) do
      {:ok, ^version} -> :ok
      :error when required? -> {:error, Articles.ErrorCat.draft_conflict()}
      :error -> :ok
      _ -> {:error, Articles.ErrorCat.draft_conflict()}
    end
  end

  defp ensure_expected_version(%{version: version}, opts) when is_list(opts) do
    required? = Keyword.get(opts, :require_expected_version, false)

    case Keyword.fetch(opts, :expected_version) do
      {:ok, ^version} -> :ok
      :error when required? -> {:error, Articles.ErrorCat.draft_conflict()}
      :error -> :ok
      _ -> {:error, Articles.ErrorCat.draft_conflict()}
    end
  end

  defp ensure_expected_version(_draft, _opts), do: :ok

  defp ensure_expected_lifecycle_version(%{version: version}, opts) when is_map(opts) do
    required? = Map.get(opts, :require_expected_version, false)

    case Map.fetch(opts, :expected_lifecycle_version) do
      {:ok, ^version} -> :ok
      :error when required? -> {:error, Articles.ErrorCat.lifecycle_conflict()}
      :error -> :ok
      _ -> {:error, Articles.ErrorCat.lifecycle_conflict()}
    end
  end

  defp ensure_expected_lifecycle_version(%{version: version}, opts) when is_list(opts) do
    required? = Keyword.get(opts, :require_expected_version, false)

    case Keyword.fetch(opts, :expected_lifecycle_version) do
      {:ok, ^version} -> :ok
      :error when required? -> {:error, Articles.ErrorCat.lifecycle_conflict()}
      :error -> :ok
      _ -> {:error, Articles.ErrorCat.lifecycle_conflict()}
    end
  end

  defp ensure_expected_lifecycle_version(_lifecycle, _opts), do: :ok

  defp resolve_branch(%Community{} = community, :doc, branch_ref),
    do: Branch.resolve(community, branch_ref)

  defp resolve_branch(_community, _thread, _branch_ref), do: {:ok, nil}

  defp transition_lifecycle(community, :doc, draft, branch, state, _opts) do
    DocLifecycle.transition(community.id, branch.id, draft.article_hash_id, state)
  end

  defp transition_lifecycle(community, thread, draft, _branch, state, opts) do
    lifecycle_query =
      ArticleLifecycle
      |> where(
        [lifecycle],
        lifecycle.community_id == ^community.id and lifecycle.thread == ^thread and
          lifecycle.article_hash_id == ^draft.article_hash_id
      )
      |> lock("FOR UPDATE")

    with %ArticleLifecycle{} = lifecycle <- Repo.one(lifecycle_query),
         :ok <- ensure_expected_lifecycle_version(lifecycle, opts) do
      ArticleLifecycleService.transition(lifecycle, state)
    else
      nil -> {:error, ErrorCat.lifecycle_not_found()}
      error -> error
    end
  end

  defp maybe_snapshot(:doc, article, user),
    do: Snapshot.checkpoint_article(article, CMS.Docs.Const.doc_snapshot_action(:publish), user)

  defp maybe_snapshot(_thread, _article, _user), do: {:ok, nil}
end
