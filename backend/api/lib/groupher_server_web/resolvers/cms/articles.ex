defmodule GroupherServerWeb.Resolvers.CMS.Articles do
  @moduledoc """
  Adapts Article queries and mutations to public CMS article use cases.

      GraphQL Article field -> this resolver -> CMS.Articles facade
  """

  import ShortMaps

  alias GroupherServer.{CMS, FrontDesk}
  alias GroupherServer.CMS.Helper.ArticlePath
  alias GroupherServer.CMS.Model.Community

  def cover_edit_info(article, _, %{context: %{cur_user: user}}) do
    CMS.Articles.cover_edit_info(article, user)
  end

  def cover_edit_info(article, _, _) do
    CMS.Articles.cover_edit_info(article, nil)
  end

  def read_article(root, args, info) do
    read_article(root, args, info, [])
  end

  def read_article(_root, %{article: article_path}, info, opts) do
    with {:ok, article_path} <- ArticlePath.parse(article_path, opts) do
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

  def set_post_cat(_root, %{article: article, cat: cat}, %{context: %{cur_user: user}}) do
    CMS.Articles.set_cat_result(article, cat, user)
  end

  def set_post_status(_root, %{article: article, status: status}, %{context: %{cur_user: user}}) do
    CMS.Articles.set_status_result(article, status, user)
  end

  def paged_articles(_root, ~m(thread filter)a, %{context: %{cur_user: user}}) do
    CMS.Articles.page(thread, filter, user)
  end

  def paged_articles(_root, ~m(thread filter)a, _info) do
    CMS.Articles.page(thread, filter)
  end

  def grouped_kanban_posts(_root, %{community: community}, _info) do
    CMS.Articles.grouped_kanban(community)
  end

  def paged_kanban_posts(_root, %{community: community, filter: filter}, _info) do
    CMS.Articles.paged_kanban(community, filter)
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
    CMS.Articles.update(
      article,
      args |> Map.drop([:article, :command_id]) |> Map.put(:cur_user, user),
      user,
      args[:command_id]
    )
  end

  def trash_article(_root, %{article: article} = args, %{context: %{cur_user: user}}) do
    CMS.Articles.trash(article, user, command_id: args[:command_id])
  end

  def restore_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]
    CMS.Articles.restore_trashed(id, user, opts)
  end

  def permanently_delete_trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    command_id = args[:command_id]
    opts = [command_id: command_id, community_id: community.id, thread: thread]
    CMS.Articles.permanently_delete_trashed(id, user, opts)
  end

  def permanently_delete_trash_action(
        _root,
        %{id: id, community: %Community{} = community, thread: thread} = args,
        %{context: %{cur_user: user}}
      ) do
    CMS.Trash.permanently_delete_action_in_scope(id, community.id, thread, user,
      command_id: args[:command_id]
    )
  end

  def trashed_articles(
        _root,
        %{community: %Community{} = community, thread: thread} = args,
        _info
      ) do
    filter = (Map.get(args, :filter) || %{}) |> Map.put(:thread, thread)
    CMS.Articles.list_trashed(community, filter)
  end

  def trashed_article(
        _root,
        %{id: id, community: %Community{} = community, thread: thread},
        _info
      ) do
    CMS.Articles.get_trashed(id, community, thread)
  end

  def pin_article(_root, ~m(article article_path)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.Articles.pin(community, article.id, user)
    end
  end

  def undo_pin_article(_root, ~m(article article_path)a, %{context: %{cur_user: user}}) do
    with {:ok, community} <- article_path_community(article_path) do
      CMS.Articles.undo_pin(community, article.id, user)
    end
  end

  def sink_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.sink_result(article, user)
  end

  def undo_sink_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.undo_sink_result(article, user)
  end

  def mirror_article(_root, ~m(target_community article community_tags)a, %{
        context: %{cur_user: user}
      }) do
    CMS.Articles.mirror(target_community, article.id, community_tags, user)
  end

  def unmirror_article(_root, ~m(target_community article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.unmirror(target_community, article.id, user)
  end

  def move_article(_root, ~m(target_community article community_tags)a, %{
        context: %{cur_user: user}
      }) do
    CMS.Articles.move(target_community, article.id, community_tags, user)
  end

  defp do_read_article(
         %{community: community, thread: thread, inner_id: inner_id},
         %{context: context}
       ) do
    article_path = %{community: community, thread: thread, inner_id: inner_id}
    FrontDesk.article(article_path, Map.get(context, :cur_user))
  end

  defp create_article(_root, ~m(community thread)a = args, %{context: %{cur_user: user}}) do
    CMS.Articles.create(community, thread, Map.put(args, :cur_user, user), user,
      command_id: args[:command_id]
    )
  end

  defp create_article_draft(
         _root,
         ~m(community thread)a = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.Articles.create_stable_draft_result(
      community,
      thread,
      Map.put(args, :cur_user, user),
      user
    )
  end

  defp update_article_draft(
         _root,
         %{article: article} = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.Articles.update_draft(
      article.id,
      args
      |> Map.drop([:community, :thread, :id, :article, :passport_is_owner])
      |> Map.put(:cur_user, user),
      user,
      expected_version: args[:expected_version]
    )
  end

  defp publish_article_draft(
         _root,
         %{article: article} = args,
         %{context: %{cur_user: user}}
       ) do
    CMS.Articles.publish(article, user,
      expected_draft_version: args[:expected_version],
      expected_lifecycle_version: args[:expected_lifecycle_version],
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
