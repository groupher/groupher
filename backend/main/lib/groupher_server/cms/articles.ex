defmodule GroupherServer.CMS.Articles do
  @moduledoc """
  Public CMS facade for product Articles and the shared version lifecycle.

      Post / Blog / Changelog / Doc
                    |
                    v
      article_hash_id + ArticleBranch
                    |
          +---------+----------+
          |                    |
          v                    v
      mutable Draft       immutable Snapshot
          |                    |
          +--> Publish         +--> Diff / Restore / TimeMachine
          |
          +--> Preview fork/promote

  Docs-specific Tree and `DocPublishRelease` composition stays outside this
  facade; Docs wrappers translate product `doc_id` language only at the edge.
  """

  alias Helper.T

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Artiment.Enums
  alias CMS.Model.{ArticleCollect, Community}

  alias __MODULE__.{
    Collects,
    Draft,
    List,
    Moderation,
    Preview,
    Publish,
    Reactions,
    Read,
    Snapshot,
    States,
    Trash,
    Upvotes
  }

  # Read
  @spec read(Community.t(), T.thread(), T.id()) :: T.domain_res(T.article())
  def read(%Community{} = community, thread, inner_id),
    do: Read.read(community, thread, inner_id)

  @spec read(Community.t(), T.thread(), T.id(), User.t()) :: T.domain_res(T.article())
  def read(%Community{} = community, thread, inner_id, %User{} = user) do
    Read.read(community, thread, inner_id, user)
  end

  # List

  @spec page(T.thread(), map()) :: T.domain_res(T.paged_data())
  def page(thread, filter), do: List.page(thread, filter)

  @spec page(T.thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  def page(thread, filter, %User{} = user), do: List.page(thread, filter, user)

  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  def grouped_kanban(%Community{} = community), do: List.grouped_kanban(community)

  @spec paged_kanban(Community.t(), map()) :: T.domain_res(term())
  def paged_kanban(%Community{} = community, filter), do: List.paged_kanban(community, filter)

  @spec paged_published(T.thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_published(thread, filter, %User{} = user) do
    List.paged_published(thread, filter, user)
  end

  @spec count_published(T.thread(), User.t()) :: T.domain_res(non_neg_integer())
  def count_published(thread, %User{} = user),
    do: List.count_published(thread, user)

  # Write

  @doc "Creates and immediately publishes an Article through the shared lifecycle."
  @spec create(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    Publish.create(community, thread, attrs, user)
  end

  @spec update(T.article(), map()) :: T.domain_res(T.article())
  def update(article, attrs), do: Publish.update(article, attrs)

  @doc "Updates and immediately republishes an Article through the shared lifecycle."
  @spec update(T.article(), map(), User.t()) :: T.domain_res(T.article())
  def update(article, attrs, %User{} = user), do: Publish.update(article, attrs, user)

  # Shared Draft / Snapshot lifecycle

  @doc "Creates a branch-local draft for any Article thread."
  @spec create_draft(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create_draft(%Community{} = community, thread, attrs, %User{} = user) do
    Draft.create(community, thread, attrs, user)
  end

  @doc "Reads a branch-local draft for any Article thread."
  @spec read_draft(Community.t(), T.thread(), Ecto.UUID.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def read_draft(%Community{} = community, thread, article_hash_id, opts \\ []) do
    Draft.read(community, thread, article_hash_id, opts)
  end

  @doc "Reads the official main/public Article head by stable logical identity."
  @spec read_public(Community.t(), T.thread(), Ecto.UUID.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def read_public(%Community{} = community, thread, article_hash_id, opts \\ []) do
    Draft.read_public(community, thread, article_hash_id, opts)
  end

  @doc "Reads the editor head, with main-draft to main-public fallback."
  @spec read_editor(Community.t(), T.thread(), Ecto.UUID.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def read_editor(%Community{} = community, thread, article_hash_id, opts \\ []) do
    Draft.read_editor(community, thread, article_hash_id, opts)
  end

  @doc "Creates the editable Draft from main/public when needed, then applies an update."
  @spec update_draft(Community.t(), T.thread(), Ecto.UUID.t(), map(), User.t()) ::
          T.domain_res(T.article())
  def update_draft(community, thread, article_hash_id, attrs, %User{} = user) do
    Draft.update_or_create_from_public(community, thread, article_hash_id, attrs, user)
  end

  @doc "Lists one Article's branch-local immutable revision history."
  @spec list_snapshots(Community.t(), T.thread(), Ecto.UUID.t(), keyword() | map()) ::
          T.domain_res([CMS.Model.ArticleSnapshot.t()])
  def list_snapshots(%Community{} = community, thread, article_hash_id, opts \\ []) do
    Snapshot.list(community, thread, article_hash_id, opts)
  end

  @doc "Fetches one immutable Article Snapshot."
  @spec get_snapshot(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          Ecto.UUID.t(),
          keyword() | map()
        ) ::
          T.domain_res(CMS.Model.ArticleSnapshot.t())
  def get_snapshot(
        %Community{} = community,
        thread,
        article_hash_id,
        snapshot_hash_id,
        opts \\ []
      ) do
    Snapshot.get(community, thread, article_hash_id, snapshot_hash_id, opts)
  end

  @doc "Creates a deduplicated checkpoint of one Article draft."
  @spec checkpoint_draft(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          User.t() | nil,
          keyword() | map()
        ) :: T.domain_res(CMS.Model.ArticleSnapshot.t())
  def checkpoint_draft(community, thread, article_hash_id, user \\ nil, opts \\ []) do
    Snapshot.checkpoint(community, thread, article_hash_id, user, opts)
  end

  @doc "Restores one Snapshot into a target branch draft without deleting history."
  @spec restore_snapshot(
          Community.t(),
          T.thread(),
          Ecto.UUID.t(),
          Ecto.UUID.t(),
          User.t() | nil,
          keyword() | map()
        ) :: T.domain_res(T.article())
  def restore_snapshot(
        community,
        thread,
        article_hash_id,
        snapshot_hash_id,
        user \\ nil,
        opts \\ []
      ) do
    Snapshot.restore(community, thread, article_hash_id, snapshot_hash_id, user, opts)
  end

  @doc "Publishes one main Draft and returns its public Article and immutable Snapshot."
  @spec publish_draft(Community.t(), T.thread(), Ecto.UUID.t(), User.t(), keyword() | map()) ::
          T.domain_res(%{
            article: T.article(),
            snapshot: CMS.Model.ArticleSnapshot.t()
          })
  def publish_draft(community, thread, article_hash_id, %User{} = user, opts \\ []) do
    Publish.publish(community, thread, article_hash_id, user, opts)
  end

  @doc "Computes an ephemeral Diff between two immutable Article Snapshots."
  def diff_snapshots(left, right), do: __MODULE__.Diff.compare(left, right)

  @doc "Computes an ephemeral Diff from a current Article row to a Snapshot."
  def diff_current(article, snapshot), do: __MODULE__.Diff.compare_current(article, snapshot)

  @doc "Forks one main/public Article into a new isolated Preview branch."
  def fork_preview(community, thread, article_hash_id, attrs, %User{} = user) do
    Preview.fork(community, thread, article_hash_id, attrs, user)
  end

  @doc "Promotes one Preview draft into main/draft without publishing it."
  def promote_preview(community, thread, article_hash_id, preview_ref, %User{} = user) do
    Preview.promote(community, thread, article_hash_id, preview_ref, user)
  end

  # Docs product language stays at the facade boundary.

  @doc "Reads a Docs editor head by product-level `doc_id`."
  def read_doc_editor(community, doc_id, opts \\ []) do
    read_editor(community, :doc, doc_id, opts)
  end

  @doc "Lists Docs revisions by product-level `doc_id`."
  def list_doc_draft_snapshots(community, doc_id, opts \\ []) do
    list_snapshots(community, :doc, doc_id, opts)
  end

  @doc "Fetches one Docs revision by product-level `doc_id`."
  def get_doc_draft_snapshot(community, doc_id, snapshot_id, opts \\ []) do
    get_snapshot(community, :doc, doc_id, snapshot_id, opts)
  end

  @doc "Creates a Docs draft checkpoint by product-level `doc_id`."
  def checkpoint_doc_draft_snapshot(community, doc_id, user \\ nil, opts \\ []) do
    checkpoint_draft(community, :doc, doc_id, user, opts)
  end

  @doc "Restores a Docs revision into the target Docs draft."
  def restore_doc_draft_snapshot(community, doc_id, snapshot_id, user \\ nil, opts \\ []) do
    restore_snapshot(community, :doc, doc_id, snapshot_id, user, opts)
  end

  @doc "Publishes one Docs draft by product-level `doc_id`."
  def publish_doc_draft(community, doc_id, %User{} = user, opts \\ []) do
    with {:ok, %{snapshot: snapshot}} <- publish_draft(community, :doc, doc_id, user, opts) do
      {:ok, snapshot}
    end
  end

  # Lifecycle

  @doc "Excludes logical Articles that currently belong to Trash."
  @spec active_scope(Ecto.Queryable.t(), T.thread()) :: Ecto.Query.t()
  def active_scope(queryable, thread), do: Trash.active_scope(queryable, thread)

  @doc "Moves one logical Article into Trash without deleting its aggregate."
  @spec trash(T.article(), User.t() | nil, keyword()) ::
          T.domain_res(CMS.Model.TrashedArticle.t())
  def trash(article, actor, opts \\ []), do: Trash.trash(article, actor, opts)

  @doc "Restores one logical Article from Trash."
  @spec restore_trashed(Ecto.UUID.t() | CMS.Model.TrashedArticle.t(), User.t() | nil, keyword()) ::
          T.domain_res(T.article())
  def restore_trashed(item_or_ref, actor, opts \\ []), do: Trash.restore(item_or_ref, actor, opts)

  @doc "Permanently removes one standalone trashed Article aggregate."
  @spec permanently_delete_trashed(
          Ecto.UUID.t() | CMS.Model.TrashedArticle.t(),
          User.t() | nil,
          keyword()
        ) :: T.domain_res(map())
  def permanently_delete_trashed(item_or_ref, actor, opts \\ []) do
    Trash.permanently_delete(item_or_ref, actor, opts)
  end

  @doc "Lists current Article Trash memberships for a Community."
  @spec list_trashed(Community.t(), map()) :: T.domain_res(map())
  def list_trashed(%Community{} = community, filter \\ %{}), do: Trash.list(community, filter)

  @doc "Gets one current Article Trash membership by public ref."
  @spec get_trashed(Ecto.UUID.t()) :: T.domain_res(CMS.Model.TrashedArticle.t())
  def get_trashed(ref), do: Trash.get(ref)

  @spec archive(T.thread()) :: T.domain_res(term())
  def archive(thread), do: States.archive(thread)

  @spec sink(T.article()) :: T.domain_res(T.article())
  def sink(article), do: States.sink(article)

  @spec undo_sink(T.article()) :: T.domain_res(T.article())
  def undo_sink(article), do: States.undo_sink(article)

  # Meta

  @spec set_cat(T.article(), Enums.cat_enum() | nil) :: T.domain_res(T.article())
  def set_cat(article, cat), do: States.set_cat(article, cat)

  @spec set_status(T.article(), Enums.status_enum() | nil) :: T.domain_res(T.article())
  def set_status(article, status), do: States.set_status(article, status)

  @spec update_active_timestamp(T.thread(), T.article()) :: T.domain_res(T.article())
  def update_active_timestamp(thread, article) do
    States.update_active_timestamp(thread, article)
  end

  # Moderation

  @spec set_illegal(T.thread(), T.id(), map()) :: T.domain_res(T.article())
  def set_illegal(thread, id, attrs),
    do: Moderation.set_illegal(thread, id, attrs)

  @spec set_illegal(T.article(), map()) :: T.domain_res(T.article())
  def set_illegal(article, attrs), do: Moderation.set_illegal(article, attrs)

  @spec unset_illegal(T.thread(), T.id(), map()) :: T.domain_res(T.article())
  def unset_illegal(thread, id, attrs),
    do: Moderation.unset_illegal(thread, id, attrs)

  @spec unset_illegal(T.article(), map()) :: T.domain_res(T.article())
  def unset_illegal(article, attrs), do: Moderation.unset_illegal(article, attrs)

  @spec set_audit_failed(T.article(), map()) :: T.domain_res(T.article())
  def set_audit_failed(article, state), do: Moderation.set_audit_failed(article, state)

  @spec paged_audit_failed(T.thread(), map()) :: T.domain_res(T.paged_data())
  def paged_audit_failed(thread, filter),
    do: Moderation.paged_audit_failed(thread, filter)

  # Placement

  @spec pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def pin(%Community{} = community, article), do: States.pin(community, article)

  @spec undo_pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def undo_pin(%Community{} = community, article), do: States.undo_pin(community, article)

  @spec mirror(Community.t(), T.article()) :: T.domain_res(T.article())
  def mirror(%Community{} = community, article), do: States.mirror(community, article)

  @spec mirror(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror(%Community{} = community, article, article_ids) do
    States.mirror(community, article, article_ids)
  end

  @spec unmirror(Community.t(), T.article()) :: T.domain_res(T.article())
  def unmirror(%Community{} = community, article), do: States.unmirror(community, article)

  @spec move(Community.t(), T.article()) :: T.domain_res(T.article())
  def move(%Community{} = community, article), do: States.move(community, article)

  @spec move(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move(%Community{} = community, article, article_ids) do
    States.move(community, article, article_ids)
  end

  @spec move_to_blackhole(Community.t(), T.article()) :: T.domain_res(T.article())
  def move_to_blackhole(%Community{} = community, article),
    do: States.move_to_blackhole(community, article)

  @spec move_to_blackhole(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move_to_blackhole(%Community{} = community, article, article_ids) do
    States.move_to_blackhole(community, article, article_ids)
  end

  @spec mirror_to_home(Community.t(), T.article()) :: T.domain_res(T.article())
  def mirror_to_home(%Community{} = community, article),
    do: States.mirror_to_home(community, article)

  @spec mirror_to_home(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror_to_home(%Community{} = community, article, article_ids) do
    States.mirror_to_home(community, article, article_ids)
  end

  @spec lock_comments(T.article()) :: T.domain_res(T.article())
  def lock_comments(article), do: States.lock_comments(article)

  @spec undo_lock_comments(T.article()) :: T.domain_res(T.article())
  def undo_lock_comments(article), do: States.undo_lock_comments(article)

  # Reactions

  @spec emotion(T.article(), atom(), User.t()) :: T.domain_res(T.article())
  def emotion(article, emotion, %User{} = user), do: Reactions.emotion(article, emotion, user)

  @spec undo_emotion(T.article(), atom(), User.t()) :: T.domain_res(T.article())
  def undo_emotion(article, emotion, %User{} = user) do
    Reactions.undo_emotion(article, emotion, user)
  end

  # Upvotes

  @spec upvote(T.article(), User.t()) :: T.domain_res(T.article())
  def upvote(article, %User{} = user), do: Upvotes.upvote(article, user)

  @spec undo_upvote(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_upvote(article, %User{} = user), do: Upvotes.undo_upvote(article, user)

  @spec upvoted_users(T.article(), map()) :: T.domain_res(T.paged_users() | T.paged_data())
  def upvoted_users(article, filter), do: Upvotes.upvoted_users(article, filter)

  # Collects

  @spec collect(T.article(), User.t()) :: T.domain_res(T.article())
  def collect(article, %User{} = user), do: Collects.collect(article, user)

  @spec collect_ifneed(T.article(), User.t()) :: T.domain_res(T.article())
  def collect_ifneed(article, %User{} = user), do: Collects.collect_ifneed(article, user)

  @spec undo_collect(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_collect(article, %User{} = user), do: Collects.undo_collect(article, user)

  @spec undo_collect_ifneed(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_collect_ifneed(article, %User{} = user),
    do: Collects.undo_collect_ifneed(article, user)

  @spec collected_users(T.article(), map()) :: T.domain_res(T.paged_users() | T.paged_data())
  def collected_users(article, filter), do: Collects.collected_users(article, filter)

  @spec set_collect_folder(ArticleCollect.t(), term()) :: T.domain_res(ArticleCollect.t())
  def set_collect_folder(%ArticleCollect{} = collect, folder) do
    Collects.set_collect_folder(collect, folder)
  end

  @spec undo_set_collect_folder(ArticleCollect.t(), term()) :: T.domain_res(ArticleCollect.t())
  def undo_set_collect_folder(%ArticleCollect{} = collect, folder) do
    Collects.undo_set_collect_folder(collect, folder)
  end
end
