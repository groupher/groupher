defmodule GroupherServerWeb.Resolvers.CMS.Articles do
  @moduledoc """
  Adapts Article queries and mutations to public CMS article use cases.

      GraphQL Article field -> this resolver -> CMS.Articles facade
  """

  import ShortMaps

  alias GroupherServer.Pagi
  alias GroupherServer.{CMS, FrontDesk}
  alias CMS.Model.Community

  @doc "Reads cover editing information for the parent article and optional viewer."
  def cover_edit_info(article, _, %{context: %{cur_user: user}}) do
    CMS.articles_cover_edit_info(article, user)
  end

  def cover_edit_info(article, _, _) do
    CMS.articles_cover_edit_info(article, nil)
  end

  @doc "Reads an article for the current viewer using the default path parsing options."
  def read_article(root, args, info) do
    read_article(root, args, info, [])
  end

  @doc "Reads by article path or community, thread, and inner ID; options apply to path parsing."
  def read_article(_root, %{article: article_path}, info, opts) do
    with {:ok, article_path} <- CMS.parse_article_path(article_path, opts) do
      do_read_article(article_path, info)
    end
  end

  def read_article(
        _root,
        %{community: community, thread: thread, article_inner_id: inner_id},
        info,
        _opts
      ) do
    do_read_article(%{community: community, thread: thread, inner_id: inner_id}, info)
  end

  def read_article(_root, %{community: community, thread: thread, id: inner_id}, info, _opts) do
    do_read_article(%{community: community, thread: thread, inner_id: inner_id}, info)
  end

  @doc "Sets the resolved post's category for the actor and returns the command result."
  def set_post_cat(_root, %{article: article, cat: cat, command_id: command_id}, %{
        context: %{cur_user: user}
      }) do
    CMS.articles_set_cat_result(article, cat, user, command_id)
  end

  @doc "Resolves an Article Page without interpreting resource query policy."
  def article_page(_root, %{thread: thread} = args, %{context: context}) do
    CMS.articles_page(
      thread,
      Map.get(args, :filter) || %{},
      Map.get(args, :pagi),
      Map.get(context, :cur_user)
    )
  end

  @doc "Lists working copies in the community after checking edit access to the canonical article."
  def article_working_copies(
        _root,
        %{article_id: article_id, community: %Community{} = community},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal),
         {:ok, canonical} <- working_copy_read_access(user, article, community),
         {:ok, rows} <- CMS.articles_working_copies(canonical, community) do
      {:ok, rows}
    end
  end

  defp working_copy_read_access(user, article, community) do
    action = if article.thread == :doc, do: :manage_coauthors, else: :edit

    with {:ok, :pass} <- CMS.articles_co_authors_reject_working_copy_access(article, user),
         {:ok, canonical} <-
           CMS.articles_working_copy_access_check(user, action, article, community) do
      {:ok, canonical}
    end
  end

  def article_snapshots(
        _root,
        %{article_id: article_id, community: %Community{} = community},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal),
         {:ok, canonical} <-
           CMS.articles_working_copy_access_check(user, :edit, article, community),
         {:ok, rows} <- CMS.articles_snapshots(canonical, community) do
      {:ok, rows}
    end
  end

  @doc "Fetches a specific article snapshot through FrontDesk for the community and viewer."
  def article_snapshot(
        _root,
        %{article_id: article_id, snapshot_id: snapshot_id, community: %Community{} = community},
        %{context: %{cur_user: user}}
      ) do
    CMS.front_desk_article_snapshot(article_id, snapshot_id, community, user)
  end

  @doc "Pages an article's history for the signed-in user with the supplied history options."
  def paged_article_events(_root, %{article_id: article_id} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.articles_history_events(
      article_id,
      user,
      args |> Map.drop([:article_id]) |> Map.to_list()
    )
  end

  @doc "Reads one event by article and event ID with the viewer's history options."
  def article_event(_root, %{article_id: article_id, event_id: event_id} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.articles_history_event(
      article_id,
      event_id,
      user,
      Map.to_list(Map.drop(args, [:article_id, :event_id]))
    )
  end

  @doc "Compares the requested before and after states in the article's history for the viewer."
  def article_diff(_root, %{article_id: article_id} = args, %{context: %{cur_user: user}}) do
    CMS.articles_history_diff(article_id, args[:before], args[:after], user)
  end

  @doc "Creates an article with the request's history origin and returns its working copy."
  def create_article(_root, %{community: %Community{} = community, thread: thread} = args, %{
        context: %{cur_user: user} = context
      }) do
    attrs = Map.drop(args, [:community, :thread, :command_id])

    with {:ok, origin} <- GroupherServerWeb.Resolvers.CMS.HistoryOrigin.from_context(context),
         {:ok, %{working_copy: working_copy}} <-
           CMS.articles_create_article(
             community,
             thread,
             attrs,
             user,
             command_id: args.command_id,
             history_context: origin
           ) do
      {:ok, working_copy}
    else
      {:error, :history_origin_invalid} ->
        {:error,
         GroupherServerWeb.ErrorCat.service_scope_forbidden(
           "History origin capability is required"
         )}

      other ->
        other
    end
  end

  @doc "Creates and publishes an article with the request's history origin, returning the public version."
  def create_and_publish_article(
        _root,
        %{community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user} = context}
      ) do
    attrs = Map.drop(args, [:community, :thread, :command_id])

    with {:ok, origin} <- GroupherServerWeb.Resolvers.CMS.HistoryOrigin.from_context(context),
         {:ok, %{public: public}} <-
           CMS.articles_create_and_publish_article(
             community,
             thread,
             attrs,
             user,
             command_id: args.command_id,
             history_context: origin
           ) do
      {:ok, public}
    else
      {:error, :history_origin_invalid} ->
        {:error,
         GroupherServerWeb.ErrorCat.service_scope_forbidden(
           "History origin capability is required"
         )}

      other ->
        other
    end
  end

  @doc "Saves edits to the specified working copy using its revision and the request's history origin."
  def save_working_copy(
        _root,
        %{community: %Community{} = community, article_id: article_id} = args,
        %{context: %{cur_user: user} = context}
      ) do
    with {:ok, origin} <- GroupherServerWeb.Resolvers.CMS.HistoryOrigin.from_context(context),
         {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal) do
      attrs =
        Map.drop(args, [:community, :article_id, :working_copy_id, :revision, :command_id])

      CMS.articles_save_working_copy(
        article,
        community,
        args.working_copy_id,
        attrs,
        args.revision,
        user,
        args.command_id,
        origin
      )
    else
      {:error, :history_origin_invalid} ->
        {:error,
         GroupherServerWeb.ErrorCat.service_scope_forbidden(
           "History origin capability is required"
         )}

      {:error, _reason} = error ->
        error
    end
  end

  @doc "Forks a snapshot into a working copy in the requested scope and records the history origin."
  def fork_snapshot(
        _root,
        %{community: %Community{} = community, snapshot_id: snapshot_id} = args,
        %{context: %{cur_user: user} = context}
      ) do
    with {:ok, origin} <- GroupherServerWeb.Resolvers.CMS.HistoryOrigin.from_context(context),
         {:ok, working_copy} <-
           CMS.articles_fork_snapshot(
             snapshot_id,
             community,
             scope_type(args.scope_type),
             args.scope_id,
             user,
             args.command_id,
             origin
           ) do
      {:ok, working_copy}
    else
      {:error, :history_origin_invalid} ->
        {:error,
         GroupherServerWeb.ErrorCat.service_scope_forbidden(
           "History origin capability is required"
         )}

      other ->
        other
    end
  end

  @doc "Publishes a versioned working copy or a snapshot and returns the public article."
  def publish_article(
        _root,
        %{community: %Community{} = community, article_id: article_id, source: source} = args,
        %{context: %{cur_user: user} = context}
      ) do
    with {:ok, origin} <- GroupherServerWeb.Resolvers.CMS.HistoryOrigin.from_context(context),
         {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal),
         {:ok, source} <- publish_source(source) do
      CMS.articles_publish_article(
        article,
        community,
        source,
        args[:expected_public_snapshot_id],
        user,
        args.command_id,
        origin
      )
      |> case do
        {:ok, %{public: public}} -> {:ok, public}
        {:error, :public_conflict} -> {:error, CMS.article_public_head_conflict()}
        other -> other
      end
    else
      {:error, :history_origin_invalid} ->
        {:error,
         GroupherServerWeb.ErrorCat.service_scope_forbidden(
           "History origin capability is required"
         )}

      {:error, _reason} = error ->
        error
    end
  end

  @doc "Deletes the identified working copy in the community and returns `{:ok, :done}` on success."
  def delete_working_copy(
        _root,
        %{
          community: %Community{} = community,
          article_id: article_id,
          working_copy_id: working_copy_id
        } = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal),
         {:ok, _deleted} <-
           CMS.articles_delete_working_copy(
             article,
             community,
             working_copy_id,
             user,
             args.command_id
           ) do
      {:ok, :done}
    end
  end

  defp scope_type(:default), do: :default
  defp scope_type(:workspace), do: :workspace
  defp scope_type("default"), do: :default
  defp scope_type("workspace"), do: :workspace
  defp scope_type(_), do: :invalid

  defp publish_source(source) when is_map(source) do
    case {Map.get(source, :working_copy_id), Map.get(source, :revision),
          Map.get(source, :snapshot_id)} do
      {working_copy_id, revision, nil}
      when is_binary(working_copy_id) and is_integer(revision) ->
        {:ok, %{working_copy_id: working_copy_id, revision: revision}}

      {nil, nil, snapshot_id} when is_binary(snapshot_id) ->
        {:ok, %{snapshot_id: snapshot_id}}

      _ ->
        {:error, :invalid_publish_source}
    end
  end

  defp publish_source(_), do: {:error, :invalid_publish_source}

  @doc "Sends the resolved article to trash and returns the trash command receipt."
  def trash_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.articles_trash_receipt(article, user, command_id: args[:command_id])
  end

  @doc "Restores a trashed article by ID within the given community and thread, returning a receipt."
  def restore_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]
    CMS.articles_restore_trashed_receipt(id, user, opts)
  end

  @doc "Permanently deletes a trashed article within the given community and thread, returning a receipt."
  def permanently_delete_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]
    CMS.articles_permanently_delete_trashed_receipt(id, user, opts)
  end

  @doc "Executes permanent deletion by trash action ID within the specified community and thread."
  def permanently_delete_trash_action(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.trash_permanently_delete_action_in_scope(id, community.id, thread, user,
      command_id: args[:command_id]
    )
  end

  @doc "Pages a community's trashed articles, restricting the filter to the requested thread."
  def trashed_articles(
        _root,
        %{community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: actor}}
      ) do
    filter = (Map.get(args, :filter) || %{}) |> Map.put(:thread, thread)

    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.articles_list_trashed(community, filter, pagi, actor)
    end
  end

  @doc "Reads one trashed article by ID within the specified community and thread."
  def trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread},
        %{context: %{cur_user: actor}}
      ) do
    CMS.articles_get_trashed(id, community, thread, actor)
  end

  @doc "Pins the article in the community identified by its request path."
  def pin_article(_root, ~m(article article_path command_id)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.articles_pin(community, article.id, user, command_id)
    end
  end

  @doc "Removes the article's pin in the community identified by its request path."
  def undo_pin_article(_root, ~m(article article_path command_id)a, %{
        context: %{cur_user: user}
      }) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.articles_undo_pin(community, article.id, user, command_id)
    end
  end

  @doc "Applies the sink command to the resolved article for the signed-in actor."
  def sink_article(_root, ~m(article command_id)a, %{context: %{cur_user: user}}) do
    CMS.articles_sink_result(article, user, command_id)
  end

  @doc "Removes the resolved article's sunk status for the signed-in actor."
  def undo_sink_article(_root, ~m(article command_id)a, %{context: %{cur_user: user}}) do
    CMS.articles_undo_sink_result(article, user, command_id)
  end

  @doc "Mirrors the article into the target community with the supplied community tags."
  def mirror_article(_root, ~m(target_community article community_tags command_id)a, %{
        context: %{cur_user: user}
      }) do
    CMS.articles_mirror(
      target_community,
      article.id,
      community_tags,
      user,
      article.community,
      command_id
    )
  end

  @doc "Removes the article's mirror from the target community."
  def unmirror_article(_root, ~m(target_community article command_id)a, %{
        context: %{cur_user: user}
      }) do
    CMS.articles_unmirror(target_community, article.id, user, command_id)
  end

  @doc "Moves the article between resolved communities with the supplied destination tags."
  def move_article(_root, ~m(target_community article community_tags command_id)a, %{
        context: %{cur_user: user}
      }) do
    with %Community{} = source <- Map.get(article, :community),
         %Community{} = destination <- target_community do
      CMS.articles_move(source, destination, article.id, community_tags, user, command_id)
    else
      _ -> {:error, CMS.gate_error_cat_resource_not_found()}
    end
  end

  defp do_read_article(
         %{community: community, thread: thread, inner_id: inner_id},
         %{context: context}
       ) do
    article_path = %{community: community, thread: thread, inner_id: inner_id}
    FrontDesk.article(article_path, Map.get(context, :cur_user))
  end

  defp article_path_community(%{community: %Community{} = community}) do
    {:ok, community}
  end

  defp article_path_community(%{community: community}) when is_binary(community) do
    FrontDesk.community(community)
  end

  defp article_path_community(_) do
    {:error, "invalid article input"}
  end
end
