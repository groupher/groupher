defmodule GroupherServer.CMS.Articles do
  @moduledoc """
  CMS articles facade.
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
    Reactions,
    Read,
    Snapshot,
    States,
    Upvotes,
    Write
  }

  # Read
  @spec read(String.t(), T.thread(), T.id()) :: T.domain_res(T.article())
  def read(community_slug, thread, inner_id),
    do: Read.read(community_slug, thread, inner_id)

  @spec read(String.t(), T.thread(), T.id(), User.t()) :: T.domain_res(T.article())
  def read(community_slug, thread, inner_id, %User{} = user) do
    Read.read(community_slug, thread, inner_id, user)
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

  @spec create(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    Write.create(community, thread, attrs, user)
  end

  @spec update(T.article(), map()) :: T.domain_res(T.article())
  def update(article, attrs), do: Write.update(article, attrs)

  # Snapshot

  @spec read_doc_draft(Community.t(), String.t()) ::
          T.domain_res(CMS.Model.Doc.t())
  def read_doc_draft(%Community{} = community, doc_id) do
    Draft.read(community, doc_id)
  end

  @spec read_doc_editor(Community.t(), String.t()) ::
          T.domain_res(CMS.Model.Doc.t())
  def read_doc_editor(%Community{} = community, doc_id) do
    Draft.read_editor(community, doc_id)
  end

  @spec list_doc_draft_snapshots(Community.t(), String.t(), keyword()) ::
          T.domain_res([CMS.Model.ArticleSnapshot.t()])
  def list_doc_draft_snapshots(%Community{} = community, doc_id, opts \\ []) do
    Snapshot.list_doc_draft(community, doc_id, opts)
  end

  @spec get_doc_draft_snapshot(Community.t(), String.t(), T.id()) ::
          T.domain_res(CMS.Model.ArticleSnapshot.t())
  def get_doc_draft_snapshot(%Community{} = community, doc_id, snapshot_id) do
    Snapshot.get_doc_draft_snapshot(community, doc_id, snapshot_id)
  end

  @spec checkpoint_doc_draft_snapshot(Community.t(), String.t(), User.t() | nil, keyword()) ::
          T.domain_res(CMS.Model.ArticleSnapshot.t())
  def checkpoint_doc_draft_snapshot(
        %Community{} = community,
        doc_id,
        user \\ nil,
        opts \\ []
      ) do
    Snapshot.checkpoint_doc_draft(community, doc_id, user, opts)
  end

  @spec restore_doc_draft_snapshot(Community.t(), String.t(), T.id(), User.t() | nil) ::
          T.domain_res(CMS.Model.Doc.t())
  def restore_doc_draft_snapshot(
        %Community{} = community,
        doc_id,
        snapshot_id,
        user \\ nil
      ) do
    Snapshot.restore_doc_draft(community, doc_id, snapshot_id, user)
  end

  @spec publish_doc_draft(Community.t(), String.t(), User.t()) ::
          T.domain_res(CMS.Model.ArticleSnapshot.t())
  def publish_doc_draft(%Community{} = community, doc_id, %User{} = user) do
    Snapshot.publish_doc_draft(community, doc_id, user)
  end

  # Lifecycle

  @spec mark_delete(T.article()) :: T.domain_res(T.article())
  def mark_delete(article), do: Write.mark_delete(article)

  @spec undo_mark_delete(T.article()) :: T.domain_res(T.article())
  def undo_mark_delete(article), do: Write.undo_mark_delete(article)

  @spec delete(T.article()) :: T.domain_res(term())
  def delete(article), do: Write.delete(article)

  @spec delete(T.article(), String.t()) :: T.domain_res(term())
  def delete(article, reason), do: Write.delete(article, reason)

  @spec archive(T.thread()) :: T.domain_res(term())
  def archive(thread), do: States.archive(thread)

  @spec batch_mark_delete(String.t(), T.thread(), [T.id()]) :: T.domain_res(term())
  def batch_mark_delete(community, thread, id_list) do
    Write.batch_mark_delete(community, thread, id_list)
  end

  @spec batch_undo_mark_delete(String.t(), T.thread(), [T.id()]) :: T.domain_res(term())
  def batch_undo_mark_delete(community, thread, id_list) do
    Write.batch_undo_mark_delete(community, thread, id_list)
  end

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
