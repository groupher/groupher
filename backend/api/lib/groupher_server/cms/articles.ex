defmodule GroupherServer.CMS.Articles do
  @moduledoc """
  Public CMS facade for product Articles and the shared version lifecycle.

      Post / Blog / Changelog
                    |
                    v
      stable article_id + ArticleLifecycle
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

  import Ecto.Query, only: [from: 2]

  alias __MODULE__.{
    Commands,
    Communities,
    List,
    Moderation,
    States,
    Trash
  }

  alias GroupherServer.{Accounts, CMS, PublicCache, Repo}
  alias Helper.T
  alias Accounts.Model.User
  alias CMS.Artiment.Const
  alias CMS.Model.{Article, Author, Community}

  alias __MODULE__.Draft.Store, as: TargetDraft
  alias __MODULE__.Draft.Diff, as: TargetDiff
  alias __MODULE__.Publish.Target, as: TargetPublish
  alias __MODULE__.Publish.Effects, as: PublishEffects

  @doc "Moves a stable ordinary Article to a new home Community through Gate."
  @spec move(Community.t(), Ecto.UUID.t(), [T.id()], User.t()) ::
          {:ok, Article.t()} | {:error, term()}
  def move(%Community{} = community, article_id, tag_ids, %User{} = actor) do
    with_article(article_id, actor, :move, fn article ->
      source = GroupherServer.Repo.get!(Community, article.community_id)
      old_inner_id = article.inner_id

      with {:ok, moved} <- Communities.move(article, community),
           relation <-
             GroupherServer.Repo.get_by!(CMS.Model.ArticleCommunity,
               article_id: moved.id,
               role: :home
             ),
           {:ok, _relation} <- Communities.replace_tags(relation, tag_ids),
           {:ok, _source} <- CMS.Communities.update_count_field(source, article.thread),
           {:ok, _destination} <- CMS.Communities.update_count_field(community, article.thread),
           :ok <- invalidate_move(source, old_inner_id, community, moved),
           {:ok, :pass} <- CMS.SearchArtiments.Indexer.enqueue_upsert(moved) do
        {:ok, moved}
      end
    end)
  end

  @doc "Mirrors a stable ordinary Article into another Community through Gate."
  @spec mirror(Community.t(), Ecto.UUID.t(), [T.id()], User.t()) ::
          {:ok, CMS.Model.ArticleCommunity.t()} | {:error, term()}
  def mirror(%Community{} = community, article_id, tag_ids, %User{} = actor) do
    with_article(article_id, actor, :mirror, fn article ->
      with {:ok, relation} <- Communities.mirror(article, community),
           {:ok, relation} <- Communities.replace_tags(relation, tag_ids),
           :ok <- invalidate_community_scope(community, article) do
        {:ok, relation}
      end
    end)
  end

  @doc "Removes a stable ordinary Article mirror from a Community through Gate."
  @spec unmirror(Community.t(), Ecto.UUID.t(), User.t()) ::
          {:ok, :done} | {:error, term()}
  def unmirror(%Community{} = community, article_id, %User{} = actor) do
    with_article(article_id, actor, :unmirror, fn article ->
      with {:ok, :done} <- Communities.unmirror(article, community),
           :ok <- invalidate_community_scope(community, article) do
        {:ok, :done}
      end
    end)
  end

  @doc "Pins a stable ordinary Article in one of its Communities through Gate."
  @spec pin(Community.t(), Ecto.UUID.t(), User.t()) ::
          {:ok, CMS.Model.PinnedArticle.t()} | {:error, term()}
  def pin(%Community{} = community, article_id, %User{} = actor) do
    case GroupherServer.Repo.get(Article, article_id) do
      %Article{thread: :doc} ->
        {:error, :unsupported_for_doc}

      %Article{} = article ->
        CMS.Gate.Access.with_check(actor, :pin, article, fn canonical ->
          with :ok <- ensure_pin_capacity(community.id, canonical.thread) do
            Communities.pin(canonical, community)
          end
        end)

      nil ->
        {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  @doc "Removes a Community-local stable Article pin through Gate."
  @spec undo_pin(Community.t(), Ecto.UUID.t(), User.t()) :: {:ok, :done} | {:error, term()}
  def undo_pin(%Community{} = community, article_id, %User{} = actor) do
    with_article(article_id, actor, :unpin, &Communities.unpin(&1, community))
  end

  defp with_article(article_id, actor, action, callback) when is_binary(article_id) do
    case GroupherServer.Repo.get(Article, article_id) do
      %Article{} = article -> CMS.Gate.Access.with_check(actor, action, article, callback)
      nil -> {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp ensure_pin_capacity(community_id, thread) do
    count =
      GroupherServer.Repo.aggregate(
        from(pin in CMS.Model.PinnedArticle,
          where: pin.community_id == ^community_id and pin.thread == ^thread
        ),
        :count
      )

    if count < Community.max_pinned_article_count_per_thread(),
      do: :ok,
      else: {:error, CMS.Articles.ErrorCat.too_much_pinned_article("too much pinned article")}
  end

  defp invalidate_move(source, old_inner_id, destination, moved) do
    with :ok <- invalidate_community_scope(source, %{moved | inner_id: old_inner_id}),
         :ok <- invalidate_community_scope(destination, moved) do
      :ok
    end
  end

  defp invalidate_community_scope(_community, %{inner_id: inner_id})
       when not is_integer(inner_id),
       do: :ok

  defp invalidate_community_scope(%Community{} = community, article) do
    case PublicCache.invalidate_now(
           :article_visibility_changed,
           %{
             id: article.id,
             community: community.slug,
             community_id: community.id,
             thread: article.thread,
             inner_id: article.inner_id
           },
           causation_id: Ecto.UUID.generate(),
           aggregate_id: article.id,
           aggregate_type: "article"
         ) do
      {:ok, _invalidation} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  # List

  @doc "Runs `page` through the public `Articles` boundary."
  @spec page(T.thread(), map()) :: T.domain_res(T.paged_data())
  def page(thread, filter), do: List.page(thread, filter)

  @spec page(T.thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  def page(thread, filter, %User{} = user), do: List.page(thread, filter, user)

  @doc "Runs `grouped_kanban` through the public `Articles` boundary."
  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  def grouped_kanban(%Community{} = community), do: List.grouped_kanban(community)

  @doc "Returns paged kanban from the `Articles` read boundary."
  @spec paged_kanban(Community.t(), map()) :: T.domain_res(term())
  def paged_kanban(%Community{} = community, filter), do: List.paged_kanban(community, filter)

  @doc "Returns paged published from the `Articles` read boundary."
  @spec paged_published(T.thread(), map(), User.t()) :: T.domain_res(T.paged_data())
  def paged_published(thread, filter, %User{} = user) do
    List.paged_published(thread, filter, user, nil)
  end

  @spec paged_published(T.thread(), map(), User.t(), User.t() | nil) ::
          T.domain_res(T.paged_data())
  def paged_published(thread, filter, %User{} = target_user, actor) do
    List.paged_published(thread, filter, target_user, actor)
  end

  @doc "Runs `count_published` through the public `Articles` boundary."
  @spec count_published(T.thread(), User.t()) :: T.domain_res(non_neg_integer())
  def count_published(thread, %User{} = user),
    do: List.count_published(thread, user)

  # Write

  @doc "Creates and immediately publishes an Article through the shared lifecycle."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def create(community, thread, attrs, %User{} = user, opts \\ []),
    do: Commands.Create.create(community, thread, attrs, user, opts)

  @doc "Updates an Article through the authenticated idempotent command boundary."
  @spec update(T.article(), map(), User.t(), Ecto.UUID.t()) :: T.domain_res(T.article())
  def update(article, attrs, %User{} = user, command_id),
    do: Commands.Update.update(article, attrs, user, command_id)

  # Shared Article Draft lifecycle

  @doc "Creates the stable Article aggregate and its first mutable Draft workspace."
  @spec create_stable_draft(Community.t(), T.thread(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def create_stable_draft(%Community{} = community, thread, attrs, actor, opts \\ []) do
    with {:ok, author} <- target_author(actor) do
      TargetDraft.create(community, thread, attrs, author, opts)
    end
  end

  @doc "Reads the current mutable workspace by stable Article UUID and actor."
  @spec read_draft(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, struct()} | {:error, term()}
  def read_draft(article_id, %User{} = actor) when is_binary(article_id),
    do: read_draft(article_id, actor, [])

  def read_draft(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, canonical} <- CMS.Gate.Access.access_check(actor, :edit, article) do
      TargetDraft.get(canonical, opts)
    end
  end

  @doc "Reads the editor head, preferring Draft and falling back to the public projection."
  @spec read_editor(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, struct()} | {:error, term()}
  def read_editor(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, canonical} <- CMS.Gate.Access.access_check(actor, :edit, article) do
      case TargetDraft.get(canonical, opts) do
        {:ok, draft} -> {:ok, draft}
        {:error, :not_found} -> stable_public(canonical, opts)
      end
    end
  end

  @doc "Returns whether a stable Article Draft differs from its selected Public Revision."
  @spec has_unpublished_changes(Ecto.UUID.t(), User.t(), keyword()) ::
          {:ok, boolean()} | {:error, term()}
  def has_unpublished_changes(article_id, %User{} = actor, _opts)
      when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         :ok <- ordinary_article(article),
         {:ok, canonical} <- CMS.Gate.Access.access_check(actor, :edit, article) do
      TargetDiff.unpublished?(canonical)
    end
  end

  @doc "Returns a transient Draft-versus-Public diff for one stable Article."
  @spec draft_diff(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def draft_diff(article_id, %User{} = actor, _opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         :ok <- ordinary_article(article),
         {:ok, canonical} <- CMS.Gate.Access.access_check(actor, :edit, article) do
      TargetDiff.compare(canonical)
    end
  end

  @doc "Autosaves stable Article content with an optimistic Draft version guard."
  @spec update_draft(Ecto.UUID.t(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, struct()} | {:error, term()}
  def update_draft(article_id, attrs, actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, author} <- target_author(actor) do
      CMS.Gate.Access.with_check(actor_user(actor), :edit, article, fn canonical ->
        TargetDraft.update(canonical, attrs, author, opts)
      end)
    end
  end

  @doc "Discards only the mutable workspace of a published stable Article."
  @spec discard_draft(Ecto.UUID.t(), User.t(), keyword()) ::
          {:ok, :done} | {:error, term()}
  def discard_draft(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id) do
      CMS.Gate.Access.with_check(actor, :discard_draft, article, fn canonical ->
        case TargetDraft.discard(canonical, opts) do
          :ok -> {:ok, :done}
          {:error, reason} -> {:error, reason}
        end
      end)
    end
  end

  @doc "Publishes an ordinary stable Article Draft with atomic first-publish finalization."
  @spec publish(Ecto.UUID.t(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def publish(article_id, actor, opts) when is_binary(article_id) do
    case Keyword.get(opts, :command_id) do
      nil -> publish_now(article_id, actor, opts)
      _command_id -> Commands.Publish.publish(article_id, actor, opts)
    end
  end

  defp publish_now(article_id, actor, opts) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, author} <- target_author(actor),
         {:ok, result} <-
           CMS.Gate.Access.with_check(actor_user(actor), :publish, article, fn canonical ->
             Repo.transaction(fn ->
               with {:ok, published} <- TargetPublish.publish(canonical, author, opts),
                    {:ok, _finalized} <- finalize_first_publish(published, actor) do
                 published
               else
                 {:error, reason} -> Repo.rollback(reason)
               end
             end)
           end),
         {:ok, result} <- maybe_publish_effects(result, opts) do
      {:ok, result}
    end
  end

  defp maybe_publish_effects(result, opts) do
    if Keyword.get(opts, :skip_effects, false),
      do: {:ok, result},
      else: PublishEffects.run(result)
  end

  defp finalize_first_publish(%{first_publish?: false} = result, _actor), do: {:ok, result}

  defp finalize_first_publish(
         %{first_publish?: true, article: %Article{} = article} = result,
         actor
       ) do
    with %Community{} = community <- GroupherServer.Repo.get(Community, article.community_id),
         %User{} = user <- actor_user(actor),
         {:ok, _community} <- CMS.Communities.update_count_field(community, article.thread),
         {:ok, _user} <- Accounts.Publish.update_states(user, article.thread),
         {:ok, _throttle} <- CMS.Gate.RateLimit.Publish.record(user) do
      {:ok, result}
    else
      nil -> {:error, :publish_finalization_context_not_found}
      {:error, reason} -> {:error, reason}
    end
  end

  defp target_author(%Author{} = author), do: {:ok, author}
  defp target_author(%User{} = user), do: __MODULE__.Writer.ensure_author_exists(user)
  defp target_author(_actor), do: {:error, :invalid_actor}

  defp actor_user(%User{} = user), do: user
  defp actor_user(%Author{user: %User{} = user}), do: user
  defp actor_user(%Author{user_id: user_id}), do: GroupherServer.Repo.get(User, user_id)

  defp stable_article(article_id) do
    case GroupherServer.Repo.get(Article, article_id) do
      %Article{} = article -> {:ok, article}
      nil -> {:error, :article_not_found}
    end
  end

  defp ordinary_article(%Article{thread: :doc}), do: {:error, :doc_branch_required}
  defp ordinary_article(%Article{}), do: :ok

  defp stable_public(%Article{thread: :doc, id: article_id}, opts) do
    branch_id = Keyword.fetch!(opts, :branch_id)

    case GroupherServer.Repo.get_by(CMS.Model.DocPublic,
           article_id: article_id,
           branch_id: branch_id
         ) do
      %CMS.Model.DocPublic{} = public -> {:ok, public}
      nil -> {:error, :not_found}
    end
  end

  defp stable_public(%Article{id: article_id}, _opts) do
    case GroupherServer.Repo.get(CMS.Model.ArticlePublic, article_id) do
      %CMS.Model.ArticlePublic{} = public -> {:ok, public}
      nil -> {:error, :not_found}
    end
  end

  # Lifecycle

  @doc "Moves one logical Article into Trash without deleting its aggregate."
  @spec trash(T.article(), User.t() | nil, keyword()) ::
          T.domain_res(CMS.Model.TrashedArticle.t())
  def trash(article, actor, opts \\ []), do: Commands.Trash.trash(article, actor, opts)

  @doc "Restores one logical Article from Trash."
  @spec restore_trashed(Ecto.UUID.t(), User.t() | nil, keyword()) ::
          T.domain_res(T.article())
  def restore_trashed(trash_item_id, actor, opts \\ []) when is_binary(trash_item_id),
    do: Commands.Trash.restore(trash_item_id, actor, opts)

  @doc "Permanently removes one standalone trashed Article aggregate."
  @spec permanently_delete_trashed(
          Ecto.UUID.t(),
          User.t() | nil,
          keyword()
        ) :: T.domain_res(map())
  def permanently_delete_trashed(trash_item_id, actor, opts \\ [])
      when is_binary(trash_item_id) do
    Commands.Trash.permanently_delete(trash_item_id, actor, opts)
  end

  @doc "Permanently removes one standalone trashed Article aggregate."
  @spec permanently_delete(
          Ecto.UUID.t(),
          User.t() | nil,
          keyword()
        ) :: T.domain_res(map())
  def permanently_delete(trash_item_id, actor, opts \\ []) when is_binary(trash_item_id),
    do: Commands.Trash.permanently_delete(trash_item_id, actor, opts)

  @doc "Lists current Article Trash memberships for a Community."
  @spec list_trashed(Community.t(), map()) :: T.domain_res(map())
  def list_trashed(%Community{} = community, filter \\ %{}), do: Trash.list(community, filter)

  @doc "Gets one current Article Trash membership by its opaque Trash id."
  @spec get_trashed(Ecto.UUID.t()) :: T.domain_res(CMS.Model.TrashedArticle.t())
  def get_trashed(ref), do: Trash.get(ref)

  @doc "Runs `archive` through the public `Articles` boundary."
  @spec archive(T.thread()) :: T.domain_res(term())
  def archive(thread), do: States.archive(thread)

  @doc "Sinks one stable Article through the shared Gate and aggregate lock."
  @spec sink(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def sink(article_id, %User{} = actor, opts \\ []),
    do: change_sink(article_id, actor, :sink, opts)

  @doc "Restores one sunk stable Article through the shared Gate and aggregate lock."
  @spec undo_sink(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def undo_sink(article_id, %User{} = actor, opts \\ []),
    do: change_sink(article_id, actor, :undo_sink, opts)

  defp change_sink(article_id, actor, action, opts) do
    case GroupherServer.Repo.get(Article, article_id) do
      %Article{thread: :doc} = article ->
        branch_id = Keyword.get(opts, :branch_id) || main_branch_id(article.community_id)

        CMS.Gate.Access.with_branch_check(actor, action, article, branch_id, fn canonical ->
          apply(States, action, [canonical, [branch_id: branch_id]])
        end)

      %Article{} = article ->
        CMS.Gate.Access.with_check(actor, action, article, fn canonical ->
          apply(States, action, [canonical, opts])
        end)

      nil ->
        {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  # Meta

  @doc "Sets the stable Post category through the shared Gate and aggregate lock."
  @spec set_cat(Ecto.UUID.t(), Const.cat_enum() | nil, User.t()) :: T.domain_res(Article.t())
  def set_cat(article_id, cat, %User{} = actor),
    do: with_article(article_id, actor, :set_category, &States.set_cat(&1, cat))

  @doc "Sets the stable Post Kanban status through the shared Gate and aggregate lock."
  @spec set_status(Ecto.UUID.t(), Const.status_enum() | nil, User.t()) ::
          T.domain_res(Article.t())
  def set_status(article_id, status, %User{} = actor),
    do: with_article(article_id, actor, :set_status, &States.set_status(&1, status))

  @doc "Updates active timestamp through the `Articles` write boundary."
  @spec update_active_timestamp(T.thread(), T.article()) :: T.domain_res(T.article())
  def update_active_timestamp(thread, article) do
    States.update_active_timestamp(thread, article)
  end

  # Moderation

  @doc "Marks one stable Article illegal through Gate; Doc callers pass `branch_id` in opts."
  @spec set_illegal(Ecto.UUID.t(), map(), User.t() | :operations, keyword()) ::
          T.domain_res(term())
  def set_illegal(article_id, attrs, actor, opts \\ []),
    do: moderate(article_id, :illegal, attrs, actor, opts)

  @doc "Clears illegal state through Gate; Doc callers pass `branch_id` in opts."
  @spec unset_illegal(Ecto.UUID.t(), map(), User.t() | :operations, keyword()) ::
          T.domain_res(term())
  def unset_illegal(article_id, attrs, actor, opts \\ []),
    do: moderate(article_id, :legal, attrs, actor, opts)

  @doc "Marks one stable Article audit-failed through Gate."
  @spec set_audit_failed(Ecto.UUID.t(), map(), User.t() | :operations, keyword()) ::
          T.domain_res(term())
  def set_audit_failed(article_id, attrs, actor, opts \\ []),
    do: moderate(article_id, :audit_failed, attrs, actor, opts)

  defp moderate(article_id, state, attrs, actor, opts) do
    case GroupherServer.Repo.get(Article, article_id) do
      %Article{thread: :doc} = article ->
        branch_id = Keyword.get(opts, :branch_id) || main_branch_id(article.community_id)

        CMS.Gate.Access.with_branch_check(actor, :moderate, article, branch_id, fn canonical ->
          Moderation.set_state(canonical, state, attrs, branch_id: branch_id)
        end)

      %Article{} = article ->
        CMS.Gate.Access.with_check(actor, :moderate, article, fn canonical ->
          Moderation.set_state(canonical, state, attrs, opts)
        end)

      nil ->
        {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end

  defp main_branch_id(community_id) do
    case GroupherServer.Repo.get_by(CMS.Model.DocBranch,
           community_id: community_id,
           type: :main
         ) do
      %{id: branch_id} -> branch_id
      nil -> nil
    end
  end

  @doc "Returns paged audit failed from the `Articles` read boundary."
  @spec paged_audit_failed(T.thread(), map()) :: T.domain_res(T.paged_data())
  def paged_audit_failed(thread, filter),
    do: Moderation.paged_audit_failed(thread, filter)

  @doc "Moves one stable ordinary Article to the configured blackhole Community."
  @spec move_to_blackhole(Community.t(), Ecto.UUID.t(), [T.id()], User.t()) ::
          {:ok, Article.t()} | {:error, term()}
  def move_to_blackhole(%Community{} = community, article_id, tag_ids, %User{} = actor),
    do: move(community, article_id, tag_ids, actor)

  @doc "Mirrors one stable ordinary Article into the requested home Community."
  @spec mirror_to_home(Community.t(), Ecto.UUID.t(), [T.id()], User.t()) ::
          {:ok, CMS.Model.ArticleCommunity.t()} | {:error, term()}
  def mirror_to_home(%Community{} = community, article_id, tag_ids, %User{} = actor),
    do: mirror(community, article_id, tag_ids, actor)

  @doc "Locks comments on one stable Article through the shared Gate and aggregate lock."
  @spec lock_comments(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def lock_comments(article_id, %User{} = actor, opts \\ []),
    do: change_comment_lock(article_id, actor, :lock_comments, opts)

  @doc "Unlocks comments on one stable Article through the shared Gate and aggregate lock."
  @spec undo_lock_comments(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def undo_lock_comments(article_id, %User{} = actor, opts \\ []),
    do: change_comment_lock(article_id, actor, :unlock_comments, opts)

  defp change_comment_lock(article_id, actor, action, opts) do
    case GroupherServer.Repo.get(Article, article_id) do
      %Article{thread: :doc} = article ->
        branch_id = Keyword.get(opts, :branch_id) || main_branch_id(article.community_id)

        CMS.Gate.Access.with_branch_check(actor, action, article, branch_id, fn canonical ->
          command = if action == :lock_comments, do: :lock_comments, else: :undo_lock_comments
          apply(States, command, [canonical, [branch_id: branch_id]])
        end)

      %Article{} = article ->
        CMS.Gate.Access.with_check(actor, action, article, fn canonical ->
          command = if action == :lock_comments, do: :lock_comments, else: :undo_lock_comments
          apply(States, command, [canonical, opts])
        end)

      nil ->
        {:error, CMS.Gate.ErrorCat.resource_not_found()}
    end
  end
end
