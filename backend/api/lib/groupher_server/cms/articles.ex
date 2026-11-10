defmodule GroupherServer.CMS.Articles do
  @moduledoc """
  Public CMS facade for Article identity, WorkingCopy editing, and Snapshot publication.

      Post / Blog / Changelog
                    |
                    v
      stable article_id + ArticleLifecycle
                    |
          +---------+----------+
          |                    |
          v                    v
      mutable WorkingCopy -> immutable Snapshot -> selected Public content

  Doc-specific Branch, Lifecycle, Snapshot, Tree and Release composition lives
  under `CMS.Docs`; this facade only owns the ordinary Article core.
  """

  alias __MODULE__.{
    Commands,
    Pagination,
    Query,
    Store,
    Trash
  }

  alias __MODULE__.WorkingCopy.Query, as: WorkingCopyQuery

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias Helper.T
  alias Accounts.Model.User
  alias CMS.Artiment.Const
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, Community}

  @doc "Loads the Article's current path Community needed by cross-owner result readers."
  @spec load_community(struct()) :: {:ok, struct()} | {:error, term()}
  def load_community(article), do: Store.with_community(article)

  @doc "Moves a stable ordinary Article between explicit Communities through Gate."
  @spec move(Community.t(), Community.t(), Ecto.UUID.t(), [T.id()], User.t(), Ecto.UUID.t()) ::
          {:ok, Article.t()} | {:error, term()}
  def move(source, destination, article_id, tag_ids, %User{} = actor, command_id) do
    Commands.Move.execute(source, destination, article_id, tag_ids, actor, command_id)
  end

  @doc "Mirrors a stable ordinary Article from an explicit source Community into another Community."
  def mirror(
        %Community{} = destination,
        article_id,
        tag_ids,
        %User{} = actor,
        %Community{} = source,
        command_id
      ) do
    Commands.Mirror.execute(destination, article_id, tag_ids, actor, source, command_id)
  end

  @doc "Removes a stable ordinary ArticleBinding binding from a Community through Gate."
  @spec unmirror(Community.t(), Ecto.UUID.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, :done} | {:error, term()}
  def unmirror(%Community{} = community, article_id, %User{} = actor, command_id) do
    Commands.Unmirror.execute(community, article_id, actor, command_id)
  end

  @doc "Pins a stable ordinary Article in one of its Communities through Gate."
  @spec pin(Community.t(), Ecto.UUID.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, CMS.Model.PinnedArticle.t()} | {:error, term()}
  def pin(%Community{} = community, article_id, %User{} = actor, command_id) do
    Commands.Pin.execute(community, article_id, actor, command_id)
  end

  @doc "Removes a Community-local stable Article pin through Gate."
  @spec undo_pin(Community.t(), Ecto.UUID.t(), User.t(), Ecto.UUID.t()) ::
          {:ok, :done} | {:error, term()}
  def undo_pin(%Community{} = community, article_id, %User{} = actor, command_id) do
    Commands.Unpin.execute(community, article_id, actor, command_id)
  end

  # Query

  @doc "Runs the canonical Article list query with explicit pagination input."
  def page(thread, filter, pagi, viewer \\ nil, opts \\ []) do
    Pagination.page(thread, filter, pagi, viewer, opts)
  end

  @doc "Reads a bounded set of public ArticleLite rows by stable Article paths."
  @spec lite_paths([map()]) :: {:ok, [map()]} | {:error, term()}
  def lite_paths(paths), do: Pagination.lite_paths(paths)

  @doc "Returns the canonical public Article binding scope for joined collections."
  defdelegate public_binding_ids(), to: Pagination

  @doc "Pages an author's public Article bindings."
  def paged_published(thread, filter, pagi, user, viewer \\ nil) do
    Query.paged_published(thread, filter, pagi, user, viewer)
  end

  @doc "Runs `count_published` through the public `Articles` boundary."
  @spec count_published(T.thread(), User.t()) :: T.domain_res(non_neg_integer())
  def count_published(thread, %User{} = user) do
    Query.count_published(thread, user)
  end

  @doc "Lists an Article's editable WorkingCopies after caller-side Gate admission."
  def working_copies(%Article{} = article, %Community{} = community) do
    WorkingCopyQuery.working_copies(article, community)
  end

  @doc "Lists immutable Article Snapshots after caller-side Gate admission."
  def snapshots(%Article{} = article, %Community{} = community) do
    WorkingCopyQuery.snapshots(article, community)
  end

  @doc "Loads one immutable Snapshot owned by an Article."
  def snapshot(%Article{} = article, %Community{} = community, snapshot_id) do
    WorkingCopyQuery.snapshot(article, community, snapshot_id)
  end

  @doc "Loads one editable WorkingCopy owned by an Article."
  def working_copy(%Article{} = article, %Community{} = community, working_copy_id) do
    WorkingCopyQuery.working_copy(article, community, working_copy_id)
  end

  @doc "Loads the thread-specific fields of an Article WorkingCopy."
  def working_copy_thread_fields(%CMS.Model.ArticleWorkingCopy{} = working_copy) do
    WorkingCopyQuery.working_copy_thread_fields(working_copy)
  end

  @doc "Lists the tag IDs owned by one Article WorkingCopy."
  def working_copy_tag_ids(%CMS.Model.ArticleWorkingCopy{} = working_copy) do
    WorkingCopyQuery.working_copy_tag_ids(working_copy)
  end

  @doc "Loads the thread-specific fields of an Article Snapshot."
  def snapshot_thread_fields(%CMS.Model.ArticleSnapshot{} = snapshot) do
    WorkingCopyQuery.snapshot_thread_fields(snapshot)
  end

  @doc "Lists the tag IDs captured by one Article Snapshot."
  def snapshot_tag_ids(%CMS.Model.ArticleSnapshot{} = snapshot) do
    WorkingCopyQuery.snapshot_tag_ids(snapshot)
  end

  # Write

  @doc "Creates an unpublished stable Article with one default WorkingCopy."
  @spec create_article(Community.t(), T.thread(), map(), User.t(), keyword()) ::
          T.domain_res(map())
  def create_article(%Community{} = community, thread, attrs, %User{} = actor, opts) do
    Commands.CreateArticle.execute(community, thread, attrs, actor, opts)
  end

  @doc "Creates a new Article and publishes its first Snapshot under one command."
  def create_and_publish_article(%Community{} = community, thread, attrs, %User{} = actor, opts) do
    Commands.CreateAndPublishArticle.execute(community, thread, attrs, actor, opts)
  end

  @doc "Creates and publishes a Doc through the existing Docs branch workflow."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def create(%Community{} = community, :doc, attrs, %User{} = user, opts) do
    Commands.Create.execute(community, :doc, attrs, user, opts)
  end

  def create(_community, _thread, _attrs, _user, _opts), do: {:error, :unsupported_article_thread}

  @doc "Saves one WorkingCopy under the stable Article edit Gate and Receipt boundary."
  def save_working_copy(
        %Article{} = article,
        %Community{} = community,
        working_copy_id,
        attrs,
        revision,
        %User{} = actor,
        command_id
      ) do
    Commands.SaveWorkingCopy.execute(
      article,
      community,
      working_copy_id,
      attrs,
      revision,
      actor,
      command_id
    )
  end

  @doc "Creates an independent WorkingCopy from a frozen Snapshot under Article edit admission."
  def fork_snapshot(
        snapshot_id,
        %Community{} = community,
        scope_kind,
        scope_id,
        %User{} = actor,
        command_id
      ) do
    Commands.ForkSnapshot.execute(
      snapshot_id,
      community,
      scope_kind,
      scope_id,
      actor,
      command_id
    )
  end

  @doc "Selects an immutable Snapshot as the public Article version through Gate and Receipt."
  def publish_article(
        %Article{} = article,
        %Community{} = community,
        source,
        expected_public_snapshot_id,
        %User{} = actor,
        command_id
      ) do
    Commands.PublishArticle.execute(
      article,
      community,
      source,
      expected_public_snapshot_id,
      actor,
      command_id
    )
  end

  @doc "Discards one editable Article WorkingCopy under its Article edit Gate."
  def delete_working_copy(
        %Article{} = article,
        %Community{} = community,
        working_copy_id,
        %User{} = actor,
        command_id
      ) do
    Commands.DeleteWorkingCopy.execute(
      article,
      community,
      working_copy_id,
      actor,
      command_id
    )
  end

  @doc "Returns version-owned cover editor state when the viewer owns the Article."
  @spec cover_edit_info(map(), User.t() | nil) :: {:ok, map() | nil}
  def cover_edit_info(article, viewer), do: __MODULE__.CoverEdit.read(article, viewer)

  # Lifecycle

  @doc "Moves one logical Article into Trash without deleting its aggregate."
  @spec trash(T.article(), User.t() | nil, keyword()) ::
          T.domain_res(CMS.Model.TrashedArticle.t())
  def trash(article, actor, opts \\ []), do: Commands.Trash.execute_direct(article, actor, opts)

  @doc "Moves one Article to Trash through the retry-safe Receipt pipeline."
  def trash_receipt(article, actor, opts), do: Commands.Trash.execute(article, actor, opts)

  @doc "Restores one logical Article from Trash."
  @spec restore_trashed(Ecto.UUID.t(), User.t() | nil, keyword()) ::
          T.domain_res(T.article())
  def restore_trashed(trash_item_id, actor, opts \\ []) when is_binary(trash_item_id) do
    Commands.RestoreTrashed.execute_direct(trash_item_id, actor, opts)
  end

  @doc "Restores one trashed Article through the retry-safe Receipt pipeline."
  def restore_trashed_receipt(trash_item_id, actor, opts) when is_binary(trash_item_id) do
    Commands.RestoreTrashed.execute(trash_item_id, actor, opts)
  end

  @doc "Permanently removes one standalone trashed Article aggregate."
  @spec permanently_delete_trashed(
          Ecto.UUID.t(),
          User.t() | nil,
          keyword()
        ) :: T.domain_res(map())
  def permanently_delete_trashed(trash_item_id, actor, opts \\ [])
      when is_binary(trash_item_id) do
    Commands.PermanentlyDeleteTrashed.execute_direct(trash_item_id, actor, opts)
  end

  @doc "Permanently deletes one trashed Article through the retry-safe Receipt pipeline."
  def permanently_delete_trashed_receipt(trash_item_id, actor, opts)
      when is_binary(trash_item_id) do
    Commands.PermanentlyDeleteTrashed.execute(trash_item_id, actor, opts)
  end

  @doc "Lists current Article Trash memberships for a Community."
  @spec list_trashed(Community.t(), map(), GroupherServer.Pagi.Params.t() | nil) ::
          T.domain_res(map())
  def list_trashed(%Community{} = community, filter, pagi) do
    Trash.list(community, filter, pagi)
  end

  @doc "Gets one current Article Trash membership by its opaque Trash id."
  @spec get_trashed(Ecto.UUID.t()) :: T.domain_res(CMS.Model.TrashedArticle.t())
  def get_trashed(ref), do: Trash.get(ref)

  @doc "Gets one current Trash membership inside its public Community/thread scope."
  @spec get_trashed(Ecto.UUID.t(), Community.t(), atom()) ::
          T.domain_res(CMS.Model.TrashedArticle.t())
  def get_trashed(ref, %Community{id: community_id}, thread) do
    Trash.get_in_scope(ref, community_id, thread)
  end

  @doc "Sinks one stable Article through the shared Gate and aggregate lock."
  @spec sink(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def sink(article_id, %User{} = actor, opts \\ []) do
    Commands.StateChange.execute(:sink, article_id, actor, opts)
  end

  @doc "Restores one sunk stable Article through the shared Gate and aggregate lock."
  @spec undo_sink(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def undo_sink(article_id, %User{} = actor, opts \\ []) do
    Commands.StateChange.execute(:undo_sink, article_id, actor, opts)
  end

  # Meta

  @doc "Sets the stable Post category through the shared Gate and aggregate lock."
  @spec set_cat(Ecto.UUID.t(), Const.cat_enum() | nil, User.t(), integer()) ::
          T.domain_res(Article.t())
  def set_cat(article_id, cat, %User{} = actor, community_id) when is_integer(community_id) do
    case FrontDesk.community(community_id, mode: :internal) do
      {:ok, %Community{} = community} ->
        Commands.StateChange.set_category(article_id, cat, actor, community)

      {:error, _reason} ->
        {:error, GateErrorCat.resource_not_found()}
    end
  end

  @spec set_cat(Ecto.UUID.t(), Const.cat_enum() | nil, User.t(), integer(), Ecto.UUID.t()) ::
          T.domain_res(Article.t())
  def set_cat(article_id, cat, %User{} = actor, community_id, command_id)
      when is_integer(community_id) and is_binary(command_id) do
    case FrontDesk.community(community_id, mode: :internal) do
      {:ok, %Community{} = community} ->
        with {:ok, _command_id} <-
               GroupherServer.CMS.Command.Receipt.validate_command_id(command_id) do
          Commands.StateChange.set_category(article_id, cat, actor, community)
        end

      {:error, _reason} ->
        {:error, GateErrorCat.resource_not_found()}
    end
  end

  @doc "Updates Post category and returns the caller-facing canonical projection shape."
  def set_cat_result(article, cat, %User{} = actor) do
    with %Community{} = community <- Map.get(article, :community),
         {:ok, updated} <- set_cat(article.id, cat, actor, community.id) do
      __MODULE__.ActionResult.merge(article, updated, %{cat: cat})
    else
      _ -> {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  def set_cat_result(article, cat, %User{} = actor, command_id) do
    with %Community{} = community <- Map.get(article, :community),
         {:ok, updated} <- set_cat(article.id, cat, actor, community.id, command_id) do
      __MODULE__.ActionResult.merge(article, updated, %{cat: cat})
    else
      _ -> {:error, ArticleErrorCat.binding_context_required()}
    end
  end

  @doc "Updates active timestamp through the `Articles` write boundary."
  @spec update_active_timestamp(T.thread(), T.article()) :: T.domain_res(T.article())
  def update_active_timestamp(thread, article) do
    Commands.StateChange.update_active_timestamp(thread, article)
  end

  @doc "Locks comments on one stable Article through the shared Gate and aggregate lock."
  @spec lock_comments(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def lock_comments(article_id, %User{} = actor, opts \\ []) do
    Commands.CommentLock.execute(article_id, actor, :lock_comments, opts)
  end

  @doc "Unlocks comments on one stable Article through the shared Gate and aggregate lock."
  @spec undo_lock_comments(Ecto.UUID.t(), User.t(), keyword()) :: T.domain_res(term())
  def undo_lock_comments(article_id, %User{} = actor, opts \\ []) do
    Commands.CommentLock.execute(article_id, actor, :undo_lock_comments, opts)
  end

  @doc "Locks comments and returns the caller-facing canonical projection shape."
  def lock_comments_result(article, %User{} = actor) do
    with {:ok, updated} <- lock_comments(article.id, actor, branch_opts(article)) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  def lock_comments_result(article, %User{} = actor, command_id) do
    with {:ok, _command_id} <-
           GroupherServer.CMS.Command.Receipt.validate_command_id(command_id),
         {:ok, updated} <-
           Commands.CommentLock.execute(
             article.id,
             actor,
             :lock_comments,
             Keyword.put(branch_opts(article), :command_id, command_id)
           ) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  @doc "Unlocks comments and returns the caller-facing canonical projection shape."
  def undo_lock_comments_result(article, %User{} = actor) do
    with {:ok, updated} <- undo_lock_comments(article.id, actor, branch_opts(article)) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  def undo_lock_comments_result(article, %User{} = actor, command_id) do
    with {:ok, _command_id} <-
           GroupherServer.CMS.Command.Receipt.validate_command_id(command_id),
         {:ok, updated} <-
           Commands.CommentLock.execute(
             article.id,
             actor,
             :undo_lock_comments,
             Keyword.put(branch_opts(article), :command_id, command_id)
           ) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  @doc "Sinks an Article and returns the caller-facing canonical projection shape."
  def sink_result(article, %User{} = actor) do
    with {:ok, updated} <- sink(article.id, actor, branch_opts(article)) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  def sink_result(article, %User{} = actor, command_id) do
    with {:ok, _command_id} <-
           GroupherServer.CMS.Command.Receipt.validate_command_id(command_id),
         {:ok, updated} <-
           Commands.StateChange.execute(
             :sink,
             article.id,
             actor,
             Keyword.put(branch_opts(article), :command_id, command_id)
           ) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  @doc "Restores a sunk Article and returns the caller-facing canonical projection shape."
  def undo_sink_result(article, %User{} = actor) do
    with {:ok, updated} <- undo_sink(article.id, actor, branch_opts(article)) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  def undo_sink_result(article, %User{} = actor, command_id) do
    with {:ok, _command_id} <-
           GroupherServer.CMS.Command.Receipt.validate_command_id(command_id),
         {:ok, updated} <-
           Commands.StateChange.execute(
             :undo_sink,
             article.id,
             actor,
             Keyword.put(branch_opts(article), :command_id, command_id)
           ) do
      __MODULE__.ActionResult.merge(article, updated)
    end
  end

  defp branch_opts(article) do
    branch_opts =
      case Map.get(article, :branch_id) do
        branch_id when is_integer(branch_id) -> [branch_id: branch_id]
        _ -> []
      end

    case Map.get(article, :community) do
      %Community{} = community -> Keyword.put(branch_opts, :community, community)
      _ -> branch_opts
    end
  end
end
