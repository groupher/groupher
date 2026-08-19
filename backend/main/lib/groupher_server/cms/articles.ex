defmodule GroupherServer.CMS.Articles do
  @moduledoc """
  Public CMS facade for product Articles and the shared version lifecycle.

      Post / Blog / Changelog
                    |
                    v
      article_hash_id + ArticleLifecycle
                    |
          +---------+----------+
          |                    |
          v                    v
      mutable Draft       explicit Publish
          |
          +--> DraftDiff

  Doc-specific Branch, Lifecycle, Snapshot, Tree and Release composition lives
  under `CMS.Docs`; this facade only owns the ordinary Article core.
  """

  alias Helper.T

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Artiment.Enums
  alias CMS.Model.Community

  alias __MODULE__.{
    Draft,
    List,
    Moderation,
    Publish,
    Reader,
    States,
    Trash
  }

  # Read
  @spec read(Community.t(), T.thread(), T.id()) :: T.domain_res(T.article())
  @doc "Runs `read` through the public `Articles` boundary."
  def read(%Community{} = community, thread, inner_id),
    do: Reader.read(community, thread, inner_id)

  @spec read(Community.t(), T.thread(), T.id(), User.t()) :: T.domain_res(T.article())
  def read(%Community{} = community, thread, inner_id, %User{} = user) do
    Reader.read(community, thread, inner_id, user)
  end

  @spec read(Community.t(), T.thread(), T.id(), User.t(), Ecto.UUID.t() | nil) ::
          T.domain_res(T.article())
  def read(%Community{} = community, thread, inner_id, %User{} = user, view_event_id) do
    Reader.read(community, thread, inner_id, user, view_event_id)
  end

  # List

  @spec page(T.thread(), map()) :: T.domain_res(T.paged_data())
  @doc "Runs `page` through the public `Articles` boundary."
  def page(thread, filter), do: List.page(thread, filter)

  @spec page(T.thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  def page(thread, filter, %User{} = user), do: List.page(thread, filter, user)

  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  @doc "Runs `grouped_kanban` through the public `Articles` boundary."
  def grouped_kanban(%Community{} = community), do: List.grouped_kanban(community)

  @spec paged_kanban(Community.t(), map()) :: T.domain_res(term())
  @doc "Returns paged kanban from the `Articles` read boundary."
  def paged_kanban(%Community{} = community, filter), do: List.paged_kanban(community, filter)

  @spec paged_published(T.thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  @doc "Returns paged published from the `Articles` read boundary."
  def paged_published(thread, filter, %User{} = user) do
    List.paged_published(thread, filter, user, nil)
  end

  @spec paged_published(T.thread(), map(), User.t(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  def paged_published(thread, filter, %User{} = target_user, actor) do
    List.paged_published(thread, filter, target_user, actor)
  end

  @spec count_published(T.thread(), User.t()) :: T.domain_res(non_neg_integer())
  @doc "Runs `count_published` through the public `Articles` boundary."
  def count_published(thread, %User{} = user),
    do: List.count_published(thread, user)

  # Write

  @doc "Creates and immediately publishes an Article through the shared lifecycle."
  @spec create(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create(%Community{} = community, thread, attrs, %User{} = user) do
    Publish.create(community, thread, attrs, user)
  end

  @spec update(T.article(), map()) :: T.domain_res(T.article())
  @doc "Runs `update` through the public `Articles` boundary."
  def update(article, attrs), do: Publish.update(article, attrs)

  @doc "Starts or updates the persistent Article Draft; explicit Publish is separate."
  @spec update(T.article(), map(), User.t()) :: T.domain_res(T.article())
  def update(article, attrs, %User{} = user), do: Publish.update(article, attrs, user)

  # Shared Article Draft lifecycle

  @doc "Creates a branch-local draft for any Article thread."
  @spec create_draft(Community.t(), T.thread(), map(), User.t()) :: T.domain_res(T.article())
  def create_draft(%Community{} = community, thread, attrs, %User{} = user) do
    Draft.create(community, thread, attrs, user)
  end

  @doc "Reads a Draft through one typed :read_draft Scope query."
  @spec read_draft(Community.t(), T.thread(), Ecto.UUID.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def read_draft(%Community{} = community, thread, article_hash_id, opts \\ []) do
    opts = draft_read_opts(opts)

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

  @doc "Compares the current Draft with Public without creating history."
  def draft_diff(community, thread, article_hash_id, opts \\ []) do
    __MODULE__.DraftDiff.compare_current(community, thread, article_hash_id, opts)
  end

  @doc "Returns the Article-level unpublished-change fact."
  def has_unpublished_changes(community, thread, article_hash_id, opts \\ []) do
    __MODULE__.DraftDiff.has_unpublished_changes(community, thread, article_hash_id, opts)
  end

  defp option(opts, key, default \\ nil)
  defp option(opts, key, default) when is_list(opts), do: Keyword.get(opts, key, default)
  defp option(opts, key, default) when is_map(opts), do: Map.get(opts, key, default)
  defp option(_opts, _key, default), do: default

  defp draft_read_opts(opts) do
    if is_nil(option(opts, :actor)) or not is_nil(option(opts, :policy_mode)) do
      opts
    else
      put_option(opts, :policy_mode, :owner_management)
    end
  end

  defp put_option(opts, key, value) when is_list(opts), do: Keyword.put(opts, key, value)
  defp put_option(opts, key, value) when is_map(opts), do: Map.put(opts, key, value)
  defp put_option(_opts, key, value), do: [{key, value}]

  @doc "Publishes one ordinary Article Draft and returns its public Article."
  @spec publish_draft(Community.t(), T.thread(), Ecto.UUID.t(), User.t(), keyword() | map()) ::
          T.domain_res(%{article: T.article(), snapshot: nil})
  def publish_draft(community, thread, article_hash_id, %User{} = user, opts \\ []) do
    Publish.publish(community, thread, article_hash_id, user, opts)
  end

  # Lifecycle

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
    permanently_delete(item_or_ref, actor, opts)
  end

  @doc "Permanently removes one standalone trashed Article aggregate."
  @spec permanently_delete(
          Ecto.UUID.t() | CMS.Model.TrashedArticle.t(),
          User.t() | nil,
          keyword()
        ) :: T.domain_res(map())
  def permanently_delete(item_or_ref, actor, opts \\ []) do
    Trash.permanently_delete(item_or_ref, actor, opts)
  end

  @doc "Lists current Article Trash memberships for a Community."
  @spec list_trashed(Community.t(), map()) :: T.domain_res(map())
  def list_trashed(%Community{} = community, filter \\ %{}), do: Trash.list(community, filter)

  @doc "Gets one current Article Trash membership by public ref."
  @spec get_trashed(Ecto.UUID.t()) :: T.domain_res(CMS.Model.TrashedArticle.t())
  def get_trashed(ref), do: Trash.get(ref)

  @spec archive(T.thread()) :: T.domain_res(term())
  @doc "Runs `archive` through the public `Articles` boundary."
  def archive(thread), do: States.archive(thread)

  @spec sink(T.article()) :: T.domain_res(T.article())
  @doc "Runs `sink` through the public `Articles` boundary."
  def sink(article), do: States.sink(article)

  @spec undo_sink(T.article()) :: T.domain_res(T.article())
  @doc "Runs `undo_sink` through the public `Articles` boundary."
  def undo_sink(article), do: States.undo_sink(article)

  # Meta

  @spec set_cat(T.article(), Enums.cat_enum() | nil) :: T.domain_res(T.article())
  @doc "Runs `set_cat` through the public `Articles` boundary."
  def set_cat(article, cat), do: States.set_cat(article, cat)

  @spec set_status(T.article(), Enums.status_enum() | nil) :: T.domain_res(T.article())
  @doc "Runs `set_status` through the public `Articles` boundary."
  def set_status(article, status), do: States.set_status(article, status)

  @spec update_active_timestamp(T.thread(), T.article()) :: T.domain_res(T.article())
  @doc "Updates active timestamp through the `Articles` write boundary."
  def update_active_timestamp(thread, article) do
    States.update_active_timestamp(thread, article)
  end

  # Moderation

  @spec set_illegal(T.thread(), T.id(), map()) :: T.domain_res(T.article())
  @doc "Runs `set_illegal` through the public `Articles` boundary."
  def set_illegal(thread, id, attrs),
    do: Moderation.set_illegal(thread, id, attrs)

  @spec set_illegal(T.article(), map()) :: T.domain_res(T.article())
  def set_illegal(article, attrs), do: Moderation.set_illegal(article, attrs)

  @spec unset_illegal(T.thread(), T.id(), map()) :: T.domain_res(T.article())
  @doc "Runs `unset_illegal` through the public `Articles` boundary."
  def unset_illegal(thread, id, attrs),
    do: Moderation.unset_illegal(thread, id, attrs)

  @spec unset_illegal(T.article(), map()) :: T.domain_res(T.article())
  def unset_illegal(article, attrs), do: Moderation.unset_illegal(article, attrs)

  @spec set_audit_failed(T.article(), map()) :: T.domain_res(T.article())
  @doc "Runs `set_audit_failed` through the public `Articles` boundary."
  def set_audit_failed(article, state), do: Moderation.set_audit_failed(article, state)

  @spec paged_audit_failed(T.thread(), map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged audit failed from the `Articles` read boundary."
  def paged_audit_failed(thread, filter),
    do: Moderation.paged_audit_failed(thread, filter)

  # Placement

  @spec pin(Community.t(), T.article()) :: T.domain_res(T.article())
  @doc "Runs `pin` through the public `Articles` boundary."
  def pin(%Community{} = community, article), do: States.pin(community, article)

  @spec undo_pin(Community.t(), T.article()) :: T.domain_res(T.article())
  @doc "Runs `undo_pin` through the public `Articles` boundary."
  def undo_pin(%Community{} = community, article), do: States.undo_pin(community, article)

  @spec mirror(Community.t(), T.article()) :: T.domain_res(T.article())
  @doc "Runs `mirror` through the public `Articles` boundary."
  def mirror(%Community{} = community, article), do: States.mirror(community, article)

  @spec mirror(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror(%Community{} = community, article, article_ids) do
    States.mirror(community, article, article_ids)
  end

  @spec unmirror(Community.t(), T.article()) :: T.domain_res(T.article())
  @doc "Runs `unmirror` through the public `Articles` boundary."
  def unmirror(%Community{} = community, article), do: States.unmirror(community, article)

  @spec move(Community.t(), T.article()) :: T.domain_res(T.article())
  @doc "Runs `move` through the public `Articles` boundary."
  def move(%Community{} = community, article), do: States.move(community, article)

  @spec move(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move(%Community{} = community, article, article_ids) do
    States.move(community, article, article_ids)
  end

  @spec move_to_blackhole(Community.t(), T.article()) :: T.domain_res(T.article())
  @doc "Runs `move_to_blackhole` through the public `Articles` boundary."
  def move_to_blackhole(%Community{} = community, article),
    do: States.move_to_blackhole(community, article)

  @spec move_to_blackhole(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def move_to_blackhole(%Community{} = community, article, article_ids) do
    States.move_to_blackhole(community, article, article_ids)
  end

  @spec mirror_to_home(Community.t(), T.article()) :: T.domain_res(T.article())
  @doc "Runs `mirror_to_home` through the public `Articles` boundary."
  def mirror_to_home(%Community{} = community, article),
    do: States.mirror_to_home(community, article)

  @spec mirror_to_home(Community.t(), T.article(), [T.id()]) :: T.domain_res(T.article())
  def mirror_to_home(%Community{} = community, article, article_ids) do
    States.mirror_to_home(community, article, article_ids)
  end

  @spec lock_comments(T.article()) :: T.domain_res(T.article())
  @doc "Runs `lock_comments` through the public `Articles` boundary."
  def lock_comments(article), do: States.lock_comments(article)

  @spec undo_lock_comments(T.article()) :: T.domain_res(T.article())
  @doc "Runs `undo_lock_comments` through the public `Articles` boundary."
  def undo_lock_comments(article), do: States.undo_lock_comments(article)
end
