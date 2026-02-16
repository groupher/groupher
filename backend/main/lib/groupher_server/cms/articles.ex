defmodule GroupherServer.CMS.Articles do
  @moduledoc """
  CMS articles facade.
  """

  alias Helper.Types, as: T
  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{ArticleCollect, Community}
  alias CMS.Helper.ArticleEnums

  alias __MODULE__.{
    Read,
    List,
    Write,
    Lifecycle,
    Meta,
    Moderation,
    Placement,
    Reactions,
    Upvotes,
    Collects
  }

  # Read
  @spec read(String.t(), T.article_thread(), T.id()) :: T.domain_res(T.article())
  def read(community_slug, thread, inner_id) do
    Read.read(community_slug, thread, inner_id)
  end

  @spec read(String.t(), T.article_thread(), T.id(), User.t()) :: T.domain_res(T.article())
  def read(community_slug, thread, inner_id, %User{} = user) do
    Read.read(community_slug, thread, inner_id, user)
  end

  # List

  @spec paged(T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged(thread, filter) do
    List.paged(thread, filter)
  end

  @spec paged(T.article_thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged(thread, filter, %User{} = user) do
    List.paged(thread, filter, user)
  end

  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  def grouped_kanban(%Community{} = community) do
    List.grouped_kanban(community)
  end

  @spec paged_kanban(Community.t(), map()) :: T.domain_res(term())
  def paged_kanban(%Community{} = community, filter) do
    List.paged_kanban(community, filter)
  end

  @spec paged_published(T.article_thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_published(thread, filter, %User{} = user) do
    List.paged_published(thread, filter, user)
  end

  @spec paged_citing_contents(atom(), T.id(), map()) :: T.domain_res(T.paged_data())
  def paged_citing_contents(type, id, filter) do
    List.paged_citing_contents(type, id, filter)
  end

  # Write

  @spec create(Community.t(), T.article_thread(), map(), User.t()) :: T.domain_res(T.article())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    Write.create(community, thread, attrs, user)
  end

  @spec update(T.article(), map()) :: T.domain_res(T.article())
  def update(article, attrs) do
    Write.update(article, attrs)
  end

  # Lifecycle

  @spec mark_delete(T.article()) :: T.domain_res(T.article())
  def mark_delete(article) do
    Lifecycle.mark_delete(article)
  end

  @spec undo_mark_delete(T.article()) :: T.domain_res(T.article())
  def undo_mark_delete(article) do
    Lifecycle.undo_mark_delete(article)
  end

  @spec delete(T.article()) :: T.domain_res(term())
  def delete(article) do
    Lifecycle.delete(article)
  end

  @spec delete(T.article(), String.t()) :: T.domain_res(term())
  def delete(article, reason) do
    Lifecycle.delete(article, reason)
  end

  @spec archive(T.article_thread()) :: T.domain_res(term())
  def archive(thread) do
    Lifecycle.archive(thread)
  end

  @spec batch_mark_delete(String.t(), T.article_thread(), [T.id()]) :: T.domain_res(term())
  def batch_mark_delete(community, thread, id_list) do
    Lifecycle.batch_mark_delete(community, thread, id_list)
  end

  @spec batch_undo_mark_delete(String.t(), T.article_thread(), [T.id()]) :: T.domain_res(term())
  def batch_undo_mark_delete(community, thread, id_list) do
    Lifecycle.batch_undo_mark_delete(community, thread, id_list)
  end

  @spec sink(T.article()) :: T.domain_res(T.article())
  def sink(article) do
    Lifecycle.sink(article)
  end

  @spec undo_sink(T.article()) :: T.domain_res(T.article())
  def undo_sink(article) do
    Lifecycle.undo_sink(article)
  end

  # Meta

  @spec set_cat(T.article(), ArticleEnums.cat_enum() | nil) :: T.domain_res(T.article())
  def set_cat(article, cat) do
    Meta.set_cat(article, cat)
  end

  @spec set_state(T.article(), ArticleEnums.state_enum() | nil) :: T.domain_res(T.article())
  def set_state(article, state) do
    Meta.set_state(article, state)
  end

  @spec update_active_timestamp(T.article_thread(), T.article()) :: T.domain_res(T.article())
  def update_active_timestamp(thread, article) do
    Meta.update_active_timestamp(thread, article)
  end

  # Moderation

  @spec set_illegal(T.article_thread(), T.id(), map()) :: T.domain_res(T.article())
  def set_illegal(thread, id, attrs) do
    Moderation.set_illegal(thread, id, attrs)
  end

  @spec set_illegal(T.article(), map()) :: T.domain_res(T.article())
  def set_illegal(article, attrs) do
    Moderation.set_illegal(article, attrs)
  end

  @spec unset_illegal(T.article_thread(), T.id(), map()) :: T.domain_res(T.article())
  def unset_illegal(thread, id, attrs) do
    Moderation.unset_illegal(thread, id, attrs)
  end

  @spec unset_illegal(T.article(), map()) :: T.domain_res(T.article())
  def unset_illegal(article, attrs) do
    Moderation.unset_illegal(article, attrs)
  end

  @spec set_audit_failed(T.article(), integer()) :: T.domain_res(T.article())
  def set_audit_failed(article, state) do
    Moderation.set_audit_failed(article, state)
  end

  @spec paged_audit_failed(T.article_thread(), map()) :: T.domain_res(T.paged_data())
  def paged_audit_failed(thread, filter) do
    Moderation.paged_audit_failed(thread, filter)
  end

  # Placement

  @spec pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def pin(%Community{} = community, article), do: Placement.pin(community, article)

  @spec undo_pin(Community.t(), T.article()) :: T.domain_res(T.article())
  def undo_pin(%Community{} = community, article), do: Placement.undo_pin(community, article)

  @spec mirror(Community.t(), T.article()) :: T.domain_res(T.article())
  def mirror(%Community{} = community, article), do: Placement.mirror(community, article)

  @spec mirror(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror(%Community{} = community, article, article_ids) do
    Placement.mirror(community, article, article_ids)
  end

  @spec unmirror(Community.t(), T.article()) :: T.domain_res(T.article())
  def unmirror(%Community{} = community, article), do: Placement.unmirror(community, article)

  @spec move(Community.t(), T.article()) :: T.domain_res(T.article())
  def move(%Community{} = community, article), do: Placement.move(community, article)

  @spec move(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move(%Community{} = community, article, article_ids) do
    Placement.move(community, article, article_ids)
  end

  @spec move_to_blackhole(Community.t(), T.article()) :: T.domain_res(T.article())
  def move_to_blackhole(%Community{} = community, article),
    do: Placement.move_to_blackhole(community, article)

  @spec move_to_blackhole(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move_to_blackhole(%Community{} = community, article, article_ids) do
    Placement.move_to_blackhole(community, article, article_ids)
  end

  @spec mirror_to_home(Community.t(), T.article()) :: T.domain_res(T.article())
  def mirror_to_home(%Community{} = community, article),
    do: Placement.mirror_to_home(community, article)

  @spec mirror_to_home(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror_to_home(%Community{} = community, article, article_ids) do
    Placement.mirror_to_home(community, article, article_ids)
  end

  # Reactions

  @spec emotion(T.article(), atom(), User.t()) :: T.domain_res(T.article())
  def emotion(article, emotion, %User{} = user) do
    Reactions.emotion(article, emotion, user)
  end

  @spec undo_emotion(T.article(), atom(), User.t()) :: T.domain_res(T.article())
  def undo_emotion(article, emotion, %User{} = user) do
    Reactions.undo_emotion(article, emotion, user)
  end

  # Upvotes

  @spec upvote(T.article(), User.t()) :: T.domain_res(T.article())
  def upvote(article, %User{} = user) do
    Upvotes.upvote(article, user)
  end

  @spec undo_upvote(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_upvote(article, %User{} = user) do
    Upvotes.undo_upvote(article, user)
  end

  @spec upvoted_users(T.article(), map()) :: T.domain_res(T.paged_users() | T.paged_data())
  def upvoted_users(article, filter) do
    Upvotes.upvoted_users(article, filter)
  end

  # Collects

  @spec collect(T.article(), User.t()) :: T.domain_res(T.article())
  def collect(article, %User{} = user) do
    Collects.collect(article, user)
  end

  @spec collect_ifneed(T.article(), User.t()) :: T.domain_res(T.article())
  def collect_ifneed(article, %User{} = user) do
    Collects.collect_ifneed(article, user)
  end

  @spec undo_collect(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_collect(article, %User{} = user) do
    Collects.undo_collect(article, user)
  end

  @spec undo_collect_ifneed(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_collect_ifneed(article, %User{} = user) do
    Collects.undo_collect_ifneed(article, user)
  end

  @spec collected_users(T.article(), map()) :: T.domain_res(T.paged_users() | T.paged_data())
  def collected_users(article, filter) do
    Collects.collected_users(article, filter)
  end

  @spec set_collect_folder(ArticleCollect.t(), term()) :: T.domain_res(ArticleCollect.t())
  def set_collect_folder(%ArticleCollect{} = collect, folder) do
    Collects.set_collect_folder(collect, folder)
  end

  @spec undo_set_collect_folder(ArticleCollect.t(), term()) :: T.domain_res(ArticleCollect.t())
  def undo_set_collect_folder(%ArticleCollect{} = collect, folder) do
    Collects.undo_set_collect_folder(collect, folder)
  end
end
