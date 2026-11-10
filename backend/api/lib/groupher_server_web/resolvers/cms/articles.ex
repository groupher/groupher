defmodule GroupherServerWeb.Resolvers.CMS.Articles do
  @moduledoc """
  Adapts Article queries and mutations to public CMS article use cases.

      GraphQL Article field -> this resolver -> CMS.Articles facade
  """

  import ShortMaps

  alias GroupherServer.Pagi
  alias GroupherServer.{CMS, FrontDesk}
  alias CMS.Model.Community

  def cover_edit_info(article, _, %{context: %{cur_user: user}}) do
    CMS.articles_cover_edit_info(article, user)
  end

  def cover_edit_info(article, _, _) do
    CMS.articles_cover_edit_info(article, nil)
  end

  def read_article(root, args, info) do
    read_article(root, args, info, [])
  end

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

  def article_working_copies(
        _root,
        %{article_id: article_id, community: %Community{} = community},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal),
         {:ok, canonical} <-
           CMS.articles_working_copy_access_check(user, :edit, article, community),
         {:ok, rows} <- CMS.articles_working_copies(canonical, community) do
      {:ok, rows}
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

  def article_snapshot(
        _root,
        %{article_id: article_id, snapshot_id: snapshot_id, community: %Community{} = community},
        %{context: %{cur_user: user}}
      ) do
    with {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal),
         {:ok, canonical} <-
           CMS.articles_working_copy_access_check(user, :edit, article, community),
         {:ok, snapshot} <- CMS.articles_snapshot(canonical, community, snapshot_id) do
      {:ok, snapshot}
    end
  end

  def create_article(_root, %{community: %Community{} = community, thread: thread} = args, %{
        context: %{cur_user: user}
      }) do
    attrs = Map.drop(args, [:community, :thread, :command_id])

    case CMS.articles_create_article(
           community,
           thread,
           attrs,
           user,
           command_id: args.command_id
         ) do
      {:ok, %{working_copy: working_copy}} -> {:ok, working_copy}
      {:ok, {_article, working_copy}} -> {:ok, working_copy}
      other -> other
    end
  end

  def create_and_publish_article(
        _root,
        %{community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    attrs = Map.drop(args, [:community, :thread, :command_id])

    CMS.articles_create_and_publish_article(
      community,
      thread,
      attrs,
      user,
      command_id: args.command_id
    )
    |> case do
      {:ok, %{public: public}} -> {:ok, public}
      other -> other
    end
  end

  def save_working_copy(
        _root,
        %{community: %Community{} = community, article_id: article_id} = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal) do
      attrs =
        Map.drop(args, [:community, :article_id, :working_copy_id, :revision, :command_id])

      CMS.articles_save_working_copy(
        article,
        community,
        args.working_copy_id,
        attrs,
        args.revision,
        user,
        args.command_id
      )
    end
  end

  def fork_snapshot(
        _root,
        %{community: %Community{} = community, snapshot_id: snapshot_id} = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, working_copy} <-
           CMS.articles_fork_snapshot(
             snapshot_id,
             community,
             scope_kind(args.scope_kind),
             args.scope_id,
             user,
             args.command_id
           ) do
      {:ok, working_copy}
    end
  end

  def publish_article(
        _root,
        %{community: %Community{} = community, article_id: article_id, source: source} = args,
        %{context: %{cur_user: user}}
      ) do
    with {:ok, article} <- CMS.front_desk_article(article_id, mode: :internal),
         {:ok, source} <- publish_source(source) do
      CMS.articles_publish_article(
        article,
        community,
        source,
        args[:expected_public_snapshot_id],
        user,
        args.command_id
      )
      |> case do
        {:ok, %{public: public}} -> {:ok, public}
        other -> other
      end
    end
  end

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

  defp scope_kind(:default), do: :default
  defp scope_kind(:workspace), do: :workspace
  defp scope_kind("default"), do: :default
  defp scope_kind("workspace"), do: :workspace
  defp scope_kind(_), do: :invalid

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

  def trash_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.articles_trash_receipt(article, user, command_id: args[:command_id])
  end

  def restore_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]
    CMS.articles_restore_trashed_receipt(id, user, opts)
  end

  def permanently_delete_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]
    CMS.articles_permanently_delete_trashed_receipt(id, user, opts)
  end

  def permanently_delete_trash_action(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.trash_permanently_delete_action_in_scope(id, community.id, thread, user,
      command_id: args[:command_id]
    )
  end

  def trashed_articles(
        _root,
        %{community: %Community{} = community, thread: thread} = args,
        _info
      ) do
    filter = (Map.get(args, :filter) || %{}) |> Map.put(:thread, thread)

    with {:ok, pagi} <- Pagi.from_input(Map.get(args, :pagi)) do
      CMS.articles_list_trashed(community, filter, pagi)
    end
  end

  def trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread},
        _info
      ) do
    CMS.articles_get_trashed(id, community, thread)
  end

  def pin_article(_root, ~m(article article_path command_id)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.articles_pin(community, article.id, user, command_id)
    end
  end

  def undo_pin_article(_root, ~m(article article_path command_id)a, %{
        context: %{cur_user: user}
      }) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.articles_undo_pin(community, article.id, user, command_id)
    end
  end

  def sink_article(_root, ~m(article command_id)a, %{context: %{cur_user: user}}) do
    CMS.articles_sink_result(article, user, command_id)
  end

  def undo_sink_article(_root, ~m(article command_id)a, %{context: %{cur_user: user}}) do
    CMS.articles_undo_sink_result(article, user, command_id)
  end

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

  def unmirror_article(_root, ~m(target_community article command_id)a, %{
        context: %{cur_user: user}
      }) do
    CMS.articles_unmirror(target_community, article.id, user, command_id)
  end

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
