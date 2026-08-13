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
           +-- append publish Snapshot            +-- append publish Snapshot

  Preview branches are draft-only and can not call this module. Promote first
  copies Preview content into main/draft, then official publish follows this
  single path.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> Publish
        -> Repo / domain event
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Artiment.BodyBag
  alias CMS.Articles.{Branch, Document, Draft, Lock, Snapshot, States, VersionedRelations, Write}
  alias CMS.Model.{ArticleDocument, ArticleSnapshot, Author, Community}
  alias CMS.SearchArtiments.Indexer
  alias CMS.{Assets, Communities, Events}
  alias Ecto.Multi
  alias Helper.{ContentThumbnail, Later, ORM, T, Transaction}
  alias Helper.Validator.Slug

  import Helper.Utils, only: [plural: 1]
  import Helper.ErrorCode

  require CMS.Const

  @doc "Creates a main Draft and publishes it atomically for direct-publish products."
  @spec create(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    article_hash_id = Map.get(attrs, :article_hash_id) || Ecto.UUID.generate()
    attrs = Map.put(attrs, :article_hash_id, article_hash_id)

    Lock.run(community, thread, article_hash_id, fn ->
      with {:ok, _draft} <- Draft.create(community, thread, attrs, user),
           {:ok, %{article: public_article}} <-
             do_publish(community, thread, article_hash_id, user, attrs) do
        {:ok, public_article}
      end
    end)
  end

  @doc "Updates a public Article through a temporary main Draft and publishes it atomically."
  @spec update(T.article(), map(), User.t() | nil) :: T.domain_res(T.article())
  def update(public_article, attrs, user \\ nil)

  def update(%{is_archived: true}, _attrs, _user) do
    raise_error(:archived, "article is archived, can not be edit or delete")
  end

  def update(public_article, attrs, user) do
    with {:ok, thread} <- CMS.FrontDesk.thread_of(public_article),
         %Community{} = community <- Repo.get(Community, public_article.community_id),
         {:ok, user} <- publish_actor(public_article, user) do
      Lock.run(community, thread, public_article.article_hash_id, fn ->
        with {:ok, _draft} <-
               Draft.ensure_from_public_unlocked(
                 community,
                 thread,
                 public_article.article_hash_id,
                 Branch.main_slug(),
                 user
               ),
             {:ok, _updated_draft} <-
               Draft.update_unlocked(
                 community,
                 thread,
                 public_article.article_hash_id,
                 attrs
               ),
             {:ok, %{article: updated_public}} <-
               do_publish(
                 community,
                 thread,
                 public_article.article_hash_id,
                 user,
                 Branch.main_slug()
               ) do
          {:ok, updated_public}
        end
      end)
    else
      nil -> {:error, {:not_exist, "Article Community"}}
      error -> error
    end
  end

  @doc "Publishes one main-branch Draft and returns its public Article and immutable Snapshot."
  @spec publish(Community.t(), T.thread(), Ecto.UUID.t(), User.t(), map() | keyword()) ::
          T.domain_res(%{article: T.article(), snapshot: ArticleSnapshot.t()})
  def publish(%Community{} = community, thread, article_hash_id, %User{} = user, branch_ref) do
    Lock.run(community, thread, article_hash_id, fn ->
      do_publish(community, thread, article_hash_id, user, branch_ref)
    end)
  end

  defp do_publish(%Community{} = community, thread, article_hash_id, %User{} = user, branch_ref) do
    with {:ok, branch} <- Branch.resolve(community, thread, branch_ref),
         true <- Branch.main?(branch),
         {:ok, draft} <- Draft.read(community, thread, article_hash_id, branch),
         :ok <- validate_version(draft),
         {:ok, public_article, first_publish?} <-
           apply_draft(community, thread, branch, draft),
         {:ok, public_article} <- put_public_thumbnail(public_article, thread),
         {:ok, public_article} <-
           maybe_finalize_first_publish(
             community,
             thread,
             public_article,
             user,
             first_publish?
           ),
         {:ok, snapshot} <-
           Snapshot.checkpoint_article(
             public_article,
             CMS.Const.article_snapshot_action(:publish),
             user
           ),
         :ok <- run_after_publish(public_article, first_publish?) do
      {:ok, %{article: public_article, snapshot: snapshot}}
    else
      false -> {:error, {:custom, "preview branches can not be published"}}
      error -> error
    end
  end

  defp apply_draft(%Community{} = community, thread, branch, draft) do
    case Draft.read_public(community, thread, draft.article_hash_id, branch) do
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
         {:ok, _action} <- CMS.Gate.log_publish_action(user) do
      {:ok, public_article}
    end
  end

  defp run_after_publish(public_article, first_publish?) do
    Indexer.enqueue_upsert(public_article)
    Later.run({CMS.Press, :invalidate, [public_article.community_id]})
    Later.run({Events, :emit, [:sync_mentions, %{artiment: public_article}]})
    Later.run({Events, :emit, [:audition, %{artiment: public_article}]})

    if first_publish? do
      Later.run({Write, :notify_admin_new_article, [public_article]})
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
    if Slug.valid?(slug), do: :ok, else: {:error, {:custom, "Article slug is invalid"}}
  end

  defp validate_version(_article), do: :ok
end
