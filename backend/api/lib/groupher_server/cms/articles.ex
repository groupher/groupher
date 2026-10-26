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

  alias __MODULE__.{
    Commands,
    Pagination,
    Query,
    Store,
    Trash
  }

  alias GroupherServer.{Accounts, CMS}
  alias CMS.Articles.ErrorCat, as: ArticleErrorCat
  alias Helper.T
  alias Accounts.Model.User
  alias CMS.Artiment.Const
  alias CMS.FrontDesk
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias CMS.Model.{Article, Author, Community}

  alias __MODULE__.Draft.Store, as: TargetDraft
  alias __MODULE__.Draft.Diff, as: TargetDiff

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

  @doc "Resolves a bounded batch of Article locators through the canonical Query and Gate scope."
  @spec locators([map()]) :: T.domain_res([map()])
  def locators(locators), do: Query.locators(locators)

  @doc "Returns the canonical public Article binding scope for joined collections."
  defdelegate public_binding_ids(), to: Pagination

  @doc "Runs `grouped_kanban` through the public `Articles` boundary."
  @spec grouped_kanban(Community.t()) :: T.domain_res(term())
  def grouped_kanban(%Community{} = community), do: Query.grouped_kanban(community)

  @doc "Pages one Kanban column or status set."
  defdelegate kanban_page(community, filter, pagi), to: Query

  @doc "Pages an author's public Article bindings."
  def paged_published(thread, filter, pagi, user, viewer \\ nil) do
    Query.paged_published(thread, filter, pagi, user, viewer)
  end

  @doc "Runs `count_published` through the public `Articles` boundary."
  @spec count_published(T.thread(), User.t()) :: T.domain_res(non_neg_integer())
  def count_published(thread, %User{} = user) do
    Query.count_published(thread, user)
  end

  # Write

  @doc "Creates and immediately publishes an Article through the shared lifecycle."
  @spec create(Community.t(), T.thread(), map(), User.t(), keyword() | map()) ::
          T.domain_res(T.article())
  def create(community, thread, attrs, %User{} = user) do
    Commands.Create.execute_direct(community, thread, attrs, user, [])
  end

  def create(community, thread, attrs, %User{} = user, opts) do
    Commands.Create.execute(community, thread, attrs, user, opts)
  end

  @doc "Updates an Article through the authenticated idempotent command boundary."
  @spec update(T.article(), map(), User.t(), Ecto.UUID.t()) :: T.domain_res(T.article())
  def update(article, attrs, %User{} = user, command_id) do
    Commands.Update.execute(article, attrs, user, command_id)
  end

  # Shared Article Draft lifecycle

  @doc "Creates the stable Article aggregate and its first mutable Draft workspace."
  @spec create_stable_draft(Community.t(), T.thread(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def create_stable_draft(%Community{} = community, thread, attrs, actor) do
    Commands.CreateStableDraft.execute_direct(community, thread, attrs, actor, [])
  end

  def create_stable_draft(%Community{} = community, thread, attrs, actor, opts) do
    case actor do
      %Author{} ->
        Commands.CreateStableDraft.execute_direct(community, thread, attrs, actor, opts)

      %User{} ->
        Commands.CreateStableDraft.execute(community, thread, attrs, actor, opts)

      _ ->
        {:error, :invalid_actor}
    end
  end

  @doc "Creates a stable Draft through the explicit direct-direct pipeline."
  def create_stable_draft_write(%Community{} = community, thread, attrs, actor, opts) do
    Commands.CreateStableDraft.execute_direct(community, thread, attrs, actor, opts)
  end

  @doc "Creates a stable Article Draft and returns the editor mutation payload."
  @spec create_stable_draft_result(Community.t(), T.thread(), map(), User.t(), keyword()) ::
          T.domain_res(map())
  def create_stable_draft_result(%Community{} = community, thread, attrs, %User{} = actor) do
    with {:ok, result} <-
           Commands.CreateStableDraft.execute_direct(community, thread, attrs, actor, []) do
      __MODULE__.DraftResult.build(result)
    end
  end

  def create_stable_draft_result(
        %Community{} = community,
        thread,
        attrs,
        %User{} = actor,
        opts
      ) do
    with {:ok, result} <- create_stable_draft(community, thread, attrs, actor, opts) do
      __MODULE__.DraftResult.build(result)
    end
  end

  @doc "Returns version-owned cover editor state when the viewer owns the Article."
  @spec cover_edit_info(map(), User.t() | nil) :: {:ok, map() | nil}
  def cover_edit_info(article, viewer), do: __MODULE__.CoverEdit.read(article, viewer)

  @doc "Reads the current mutable workspace by stable Article UUID and actor."
  @spec read_draft(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, struct()} | {:error, term()}
  def read_draft(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, community} <- explicit_community(opts) do
      CMS.Gate.with_community_check(actor, :edit, community, article, fn canonical ->
        TargetDraft.get(canonical, opts)
      end)
    end
  end

  @doc "Reads the editor head, preferring Draft and falling back to the public projection."
  @spec read_editor(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, struct()} | {:error, term()}
  def read_editor(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, community} <- explicit_community(opts) do
      CMS.Gate.with_community_check(actor, :edit, community, article, fn canonical ->
        case TargetDraft.get(canonical, opts) do
          {:ok, draft} -> {:ok, draft}
          {:error, :not_found} -> stable_public(canonical, opts)
        end
      end)
    end
  end

  @doc "Returns whether a stable Article Draft differs from its selected Public Revision."
  @spec has_unpublished_changes(Ecto.UUID.t(), User.t(), keyword()) ::
          {:ok, boolean()} | {:error, term()}
  def has_unpublished_changes(article_id, %User{} = actor, opts)
      when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, _} <- ordinary_article(article),
         {:ok, community} <- explicit_community(opts) do
      CMS.Gate.with_community_check(actor, :edit, community, article, fn canonical ->
        TargetDiff.unpublished?(canonical)
      end)
    end
  end

  @doc "Returns a transient Draft-versus-Public diff for one stable Article."
  @spec draft_diff(Ecto.UUID.t(), User.t(), keyword()) :: {:ok, map()} | {:error, term()}
  def draft_diff(article_id, %User{} = actor, opts) when is_binary(article_id) do
    with {:ok, article} <- stable_article(article_id),
         {:ok, _} <- ordinary_article(article),
         {:ok, community} <- explicit_community(opts) do
      CMS.Gate.with_community_check(actor, :edit, community, article, fn canonical ->
        TargetDiff.compare(canonical)
      end)
    end
  end

  @doc "Autosaves stable Article content with an optimistic Draft version guard."
  @spec update_draft(Ecto.UUID.t(), map(), User.t() | Author.t(), keyword()) ::
          {:ok, struct()} | {:error, term()}
  def update_draft(article_id, attrs, actor, opts) when is_binary(article_id) do
    Commands.UpdateDraft.execute(article_id, attrs, actor, opts)
  end

  @doc "Discards only the mutable workspace of a published stable Article."
  @spec discard_draft(Ecto.UUID.t(), User.t(), keyword()) ::
          {:ok, :done} | {:error, term()}
  def discard_draft(article_id, %User{} = actor, opts) when is_binary(article_id) do
    Commands.DiscardDraft.execute(article_id, actor, opts)
  end

  @doc "Publishes an ordinary stable Article Draft with atomic first-publish finalization."
  @spec publish(Ecto.UUID.t() | Article.t(), User.t() | Author.t(), keyword()) ::
          {:ok, map()} | {:error, term()}
  def publish(%Article{} = article, actor, opts) do
    case actor do
      %Author{} -> Commands.Publish.execute_direct(article, actor, opts)
      %User{} -> Commands.Publish.execute(article, actor, opts)
      _ -> {:error, CMS.Articles.ErrorCat.invalid_publish_actor()}
    end
  end

  def publish(article_id, actor, opts) when is_binary(article_id) do
    with {:ok, %Article{} = article} <- stable_article(article_id) do
      publish(article, actor, opts)
    end
  end

  defp stable_article(article_id) do
    case FrontDesk.article(article_id, mode: :internal) do
      {:ok, %Article{} = article} -> {:ok, article}
      {:error, _} -> {:error, :article_not_found}
    end
  end

  defp ordinary_article(%Article{thread: :doc}), do: {:error, :doc_branch_required}
  defp ordinary_article(%Article{}), do: {:ok, :pass}

  defp explicit_community(opts) do
    case Keyword.get(opts, :community) do
      %Community{} = community ->
        {:ok, community}

      _ ->
        case Keyword.get(opts, :community_id) do
          community_id when is_integer(community_id) ->
            FrontDesk.community(community_id, mode: :internal)

          _ ->
            {:error, ArticleErrorCat.binding_context_required()}
        end
    end
  end

  defp stable_public(%Article{thread: :doc, id: article_id}, opts) do
    branch_id = Keyword.fetch!(opts, :branch_id)

    case CMS.Docs.Store.public(article_id, branch_id) do
      {:ok, %CMS.Model.DocPublic{} = public} -> {:ok, public}
      {:error, _} -> {:error, :not_found}
    end
  end

  defp stable_public(%Article{id: article_id}, _opts) do
    case Store.public(article_id) do
      {:ok, %CMS.Model.ArticlePublic{} = public} -> {:ok, public}
      {:error, _} -> {:error, :not_found}
    end
  end

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

  @doc "Sets a Post's Kanban status in one explicit ArticleBinding binding."
  @spec set_status(Ecto.UUID.t(), Const.status_enum() | nil, User.t(), integer()) ::
          T.domain_res(Article.t())
  def set_status(article_id, status, %User{} = actor, community_id)
      when is_integer(community_id) do
    with {:ok, %Article{} = article} <- FrontDesk.article(article_id, mode: :internal),
         {:ok, %Community{} = community} <- FrontDesk.community(community_id, mode: :internal) do
      set_status_in_community(article, status, actor, community)
    else
      {:error, _reason} -> {:error, GateErrorCat.resource_not_found()}
    end
  end

  @spec set_status(Ecto.UUID.t(), Const.status_enum() | nil, User.t(), integer(), Ecto.UUID.t()) ::
          T.domain_res(Article.t())
  def set_status(article_id, status, %User{} = actor, community_id, command_id)
      when is_integer(community_id) and is_binary(command_id) do
    with {:ok, %Article{} = article} <- FrontDesk.article(article_id, mode: :internal),
         {:ok, %Community{} = community} <- FrontDesk.community(community_id, mode: :internal) do
      with {:ok, _command_id} <-
             GroupherServer.CMS.Command.Receipt.validate_command_id(command_id) do
        Commands.StateChange.set_status_in_community(article, status, actor, community)
      end
    else
      {:error, _reason} -> {:error, GateErrorCat.resource_not_found()}
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

  @doc "Updates Post status and returns the caller-facing canonical projection shape."
  def set_status_result(article, status, %User{} = actor) do
    result =
      case Map.get(article, :community) do
        %Community{} = community -> set_status_in_community(article, status, actor, community)
        _ -> {:error, ArticleErrorCat.binding_context_required()}
      end

    with {:ok, updated} <- result do
      __MODULE__.ActionResult.merge(article, updated, %{status: status})
    end
  end

  def set_status_result(article, status, %User{} = actor, command_id) do
    result =
      case Map.get(article, :community) do
        %Community{} = community ->
          with {:ok, _command_id} <-
                 GroupherServer.CMS.Command.Receipt.validate_command_id(command_id) do
            Commands.StateChange.set_status_in_community(article, status, actor, community)
          end

        _ ->
          {:error, ArticleErrorCat.binding_context_required()}
      end

    with {:ok, updated} <- result do
      __MODULE__.ActionResult.merge(article, updated, %{status: status})
    end
  end

  defp set_status_in_community(
         %Article{} = article,
         status,
         %User{} = actor,
         %Community{} = community
       ) do
    Commands.StateChange.set_status_in_community(article, status, actor, community)
  end

  defp set_status_in_community(article, status, %User{} = actor, %Community{} = community) do
    Commands.StateChange.set_status_in_community(article, status, actor, community)
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
