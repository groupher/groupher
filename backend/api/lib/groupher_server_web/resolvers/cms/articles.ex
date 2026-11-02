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

  def create_post(root, args, info) do
    create_article(root, Map.put(args, :thread, :post), info)
  end

  def create_blog(root, args, info) do
    create_article(root, Map.put(args, :thread, :blog), info)
  end

  def create_changelog(root, args, info) do
    create_article(root, Map.put(args, :thread, :changelog), info)
  end

  def create_post_draft(root, args, info) do
    create_article_draft(root, Map.put(args, :thread, :post), info)
  end

  def create_blog_draft(root, args, info) do
    create_article_draft(root, Map.put(args, :thread, :blog), info)
  end

  def create_changelog_draft(root, args, info) do
    create_article_draft(root, Map.put(args, :thread, :changelog), info)
  end

  def update_post_draft(root, args, info) do
    update_article_draft(root, Map.put(args, :thread, :post), info)
  end

  def update_blog_draft(root, args, info) do
    update_article_draft(root, Map.put(args, :thread, :blog), info)
  end

  def update_changelog_draft(root, args, info) do
    update_article_draft(root, Map.put(args, :thread, :changelog), info)
  end

  def publish_post_draft(root, args, info) do
    publish_article_draft(root, Map.put(args, :thread, :post), info)
  end

  def publish_blog_draft(root, args, info) do
    publish_article_draft(root, Map.put(args, :thread, :blog), info)
  end

  def publish_changelog_draft(root, args, info) do
    publish_article_draft(root, Map.put(args, :thread, :changelog), info)
  end

  def update_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.articles_update(
      article,
      args |> Map.drop([:article, :command_id]) |> Map.put(:cur_user, user),
      user,
      args[:command_id]
    )
  end

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

  defp create_article(_root, ~m(community thread)a = args, %{context: %{cur_user: user}}) do
    CMS.articles_create(community, thread, Map.put(args, :cur_user, user), user,
      command_id: args[:command_id]
    )
  end

  defp create_article_draft(
         _root,
         ~m(community thread)a = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.articles_create_stable_draft_result(
      community,
      thread,
      Map.put(args, :cur_user, user),
      user
    )
  end

  defp update_article_draft(
         _root,
         %{article: article, community: %Community{} = community} = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.articles_update_draft(
      article.id,
      args
      |> Map.drop([:community, :thread, :id, :article, :passport_is_owner])
      |> Map.put(:cur_user, user),
      user,
      expected_version: args[:expected_version],
      community: community
    )
  end

  defp publish_article_draft(
         _root,
         %{article: article, community: %Community{} = community} = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.articles_publish(article, user,
      expected_draft_version: args[:expected_version],
      expected_lifecycle_version: args[:expected_lifecycle_version],
      community: community,
      command_id: args[:command_id]
    )
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
