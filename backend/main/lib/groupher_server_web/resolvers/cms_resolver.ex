defmodule GroupherServerWeb.Resolvers.CMS do
  @moduledoc false

  import ShortMaps
  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}

  alias Helper.{ORM, OgInfo}
  alias Accounts.Model.User
  alias CMS.Model.{Community, Category, Thread}

  # #######################
  # community ..
  # #######################
  def community(_root, %{slug: slug, inc_views: inc_views}, %{context: %{cur_user: user}}) do
    CMS.Communities.read(slug, user, inc_views: inc_views)
  end

  def community(_root, %{slug: slug, inc_views: inc_views}, _info) do
    CMS.Communities.read(slug, inc_views: inc_views)
  end

  def paged_communities(_root, ~m(filter)a, %{context: %{cur_user: user}}) do
    CMS.Communities.paged(filter, user)
  end

  def paged_communities(_root, ~m(filter)a, _info) do
    CMS.Communities.paged(filter)
  end

  def create_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.Communities.create(args, user)
  end

  def update_community(_root, %{community: community} = args, _info) do
    CMS.Communities.update(community, args)
  end

  def update_dashboard(_root, %{community: community, dashboard_section: key} = args, _info) do
    special_keys = [
      :header_links,
      :footer_links,
      :name_alias,
      :social_links,
      :media_reports,
      :faqs
    ]

    dashboard_args =
      case key in special_keys do
        true -> Map.drop(args, [:community, :dashboard_section]) |> Map.get(key)
        false -> Map.drop(args, [:community, :dashboard_section])
      end

    CMS.Communities.update_dashboard(community, key, dashboard_args)
  end

  def open_graph_info(_root, %{url: url}, _info), do: OgInfo.get(url)

  def delete_community(_root, %{id: id}, _info), do: Community |> ORM.find_delete!(id)

  def apply_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.Communities.apply(args, user)
  end

  def approve_community_apply(_root, %{community: community}, _) do
    CMS.Communities.approve_apply(community)
  end

  def deny_community_apply(_root, %{id: id}, _) do
    CMS.Communities.deny_apply(id)
  end

  def community_exist?(_root, %{slug: slug}, _) do
    CMS.Communities.exist?(slug)
  end

  def has_pending_community_apply?(_root, _, %{context: %{cur_user: user}}) do
    CMS.Communities.has_pending_apply?(user)
  end

  # #######################
  # community thread (post, job), login user should be logged
  # #######################
  def read_article(_root, %{community: community, thread: thread, id: id}, %{
        context: %{cur_user: user}
      }) do
    CMS.Articles.read(community, thread, id, user)
  end

  def read_article(_root, %{community: community, thread: thread, id: id}, _info) do
    CMS.Articles.read(community, thread, id)
  end

  def set_post_cat(_root, %{article: article, cat: cat}, _info) do
    CMS.Articles.set_cat(article, cat)
  end

  def set_post_state(_root, %{article: article, state: state}, _info) do
    CMS.Articles.set_state(article, state)
  end

  def paged_articles(_root, ~m(thread filter)a, %{context: %{cur_user: user}}) do
    CMS.Articles.paged(thread, filter, user)
  end

  def paged_articles(_root, ~m(thread filter)a, _info) do
    CMS.Articles.paged(thread, filter)
  end

  def grouped_kanban_posts(_root, %{community: community}, _info) do
    CMS.Articles.grouped_kanban(community)
  end

  def paged_kanban_posts(_root, %{community: community, filter: filter}, _info) do
    CMS.Articles.paged_kanban(community, filter)
  end

  def paged_reports(_root, ~m(filter)a, _) do
    CMS.paged_reports(filter)
  end

  def create_article(_root, ~m(community thread)a = args, %{context: %{cur_user: user}}) do
    CMS.Articles.create(community, thread, args, user)
  end

  def update_article(_root, %{article: article} = args, _info) do
    CMS.Articles.update(article, args)
  end

  def delete_article(_root, %{article: article}, _info) do
    CMS.Articles.delete(article)
  end

  # #######################
  # article actions
  # #######################
  def pin_article(_root, ~m(community article)a, _info),
    do: CMS.Articles.pin(community, article)

  def undo_pin_article(_root, ~m(community article)a, _info) do
    CMS.Articles.undo_pin(community, article)
  end

  def mark_delete_article(_root, ~m(article)a, _info) do
    CMS.Articles.mark_delete(article)
  end

  def batch_mark_delete_articles(_root, ~m(community thread ids)a, _info) do
    CMS.Articles.batch_mark_delete(community, thread, ids)
  end

  def batch_undo_mark_delete_articles(_root, ~m(community thread ids)a, _info) do
    CMS.Articles.batch_undo_mark_delete(community, thread, ids)
  end

  def undo_mark_delete_article(_root, ~m(article)a, _info) do
    CMS.Articles.undo_mark_delete(article)
  end

  def report_article(_root, ~m(article reason attr)a, %{context: %{cur_user: user}}) do
    CMS.report_article(article, reason, attr, user)
  end

  def undo_report_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.undo_report_article(article, user)
  end

  def paged_citing_contents(_root, ~m(content id filter)a, _info) do
    CMS.Articles.paged_citing_contents(content, id, filter)
  end

  # #######################
  # thread reaction ..
  # #######################
  def lock_article_comments(_root, ~m(article)a, _info), do: CMS.lock_article_comments(article)

  def undo_lock_article_comments(_root, ~m(article)a, _info) do
    CMS.undo_lock_article_comments(article)
  end

  def sink_article(_root, ~m(article)a, _info), do: CMS.Articles.sink(article)
  def undo_sink_article(_root, ~m(article)a, _info), do: CMS.Articles.undo_sink(article)

  def upvote_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.upvote(article, user)
  end

  def undo_upvote_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.Articles.undo_upvote(article, user)
  end

  def upvoted_users(_root, ~m(article filter)a, _info) do
    CMS.Articles.upvoted_users(article, filter)
  end

  def collected_users(_root, ~m(article filter)a, _info) do
    CMS.Articles.collected_users(article, filter)
  end

  def emotion_to_article(_root, ~m(article emotion)a, %{context: %{cur_user: user}}) do
    CMS.Articles.emotion(article, emotion, user)
  end

  def undo_emotion_to_article(_root, ~m(article emotion)a, %{context: %{cur_user: user}}) do
    CMS.Articles.undo_emotion(article, emotion, user)
  end

  # #######################
  # category ..
  # #######################
  def paged_categories(_root, ~m(filter)a, _info), do: Category |> ORM.find_all(filter)

  def create_category(_root, ~m(title slug)a, %{context: %{cur_user: user}}) do
    CMS.Communities.create_category(%{title: title, slug: slug}, user)
  end

  def delete_category(_root, %{id: id}, _info), do: Category |> ORM.find_delete!(id)

  def update_category(_root, ~m(id title)a, %{context: %{cur_user: _}}) do
    CMS.Communities.update_category(~m(%Category id title)a)
  end

  def set_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.Communities.set_category(community, %Category{id: category_id})
  end

  def unset_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.Communities.unset_category(community, %Category{id: category_id})
  end

  # #######################
  # thread ..
  # #######################
  def paged_threads(_root, ~m(filter)a, _info), do: Thread |> ORM.find_all(filter)

  def create_thread(_root, ~m(title slug index)a, _info),
    do: CMS.Communities.create_thread(~m(title slug index)a)

  def set_thread(_root, ~m(community thread)a, _info), do: CMS.Communities.set_thread(community, thread)

  def unset_thread(_root, ~m(community thread)a, _info), do: CMS.Communities.unset_thread(community, thread)

  # #######################
  # moderators ..
  # #######################
  def all_passport_rules(_root, _, _) do
    with {:ok, rules} <- CMS.Communities.all_passport_rules() do
      {:ok,
       %{
         root: Jason.encode!(rules.root),
         moderator: Jason.encode!(rules.moderator)
       }}
    end
  end

  def add_moderator(_root, ~m(community user role)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.add_moderator(community, role, user, cur_user)
  end

  def remove_moderator(_root, ~m(community user)a, %{context: %{cur_user: cur_user}}) do
    with {:ok, target_user} <- ORM.find_user(user) do
      CMS.Communities.remove_moderator(community, %User{id: target_user.id}, cur_user)
    end
  end

  def update_moderator_passport(_root, ~m(community user rules)a, %{
        context: %{cur_user: cur_user}
      }) do
    with {:ok, target_user} <- ORM.find_user(user) do
      CMS.Communities.update_moderator_passport(community, rules, %User{id: target_user.id}, cur_user)
    end
  end

  def paged_community_moderators(_root, ~m(id filter)a, _info) do
    CMS.Communities.members(:moderators, %Community{id: id}, filter)
  end

  # #######################
  # tags ..
  # #######################
  def create_community_tag(_root, %{thread: thread, community: community} = args, %{
        context: %{cur_user: user}
      }) do
    GroupherServer.CMS.Communities.create_tag(%Community{slug: community}, thread, args, user)
  end

  def update_community_tag(_root, %{id: id} = args, _info) do
    GroupherServer.CMS.Communities.update_tag(id, args)
  end

  def delete_community_tag(_root, %{id: id}, _info) do
    GroupherServer.CMS.Communities.delete_tag(id)
  end

  def set_community_tag(_root, ~m(article community_tag_id)a, _info) do
    GroupherServer.CMS.Communities.set_tag(article, community_tag_id)
  end

  def unset_community_tag(_root, ~m(article community_tag_id)a, _info) do
    GroupherServer.CMS.Communities.unset_tag(article, community_tag_id)
  end

  def paged_community_tags(_root, %{filter: filter}, _info) do
    GroupherServer.CMS.Communities.paged_tags(filter)
  end

  def reindex_community_tags(_root, ~m(community thread group tags)a, _info) do
    GroupherServer.CMS.Communities.reindex_tags(community, thread, group, tags)

    {:ok, %{done: true}}
  end

  # #######################
  # community subscribe ..
  # #######################
  def subscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.subscribe(community, cur_user)
  end

  def unsubscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.unsubscribe(community, cur_user)
  end

  def paged_community_subscribers(_root, ~m(id filter)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.members(:subscribers, %Community{id: id}, filter, cur_user)
  end

  def paged_community_subscribers(_root, ~m(id filter)a, _info) do
    CMS.Communities.members(:subscribers, %Community{id: id}, filter)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, %{context: %{cur_user: cur_user}}) do
    CMS.Communities.members(:subscribers, %Community{slug: community}, filter, cur_user)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, _info) do
    CMS.Communities.members(:subscribers, %Community{slug: community}, filter)
  end

  def paged_community_subscribers(_root, _args, _info), do: {:error, "invalid args"}

  def mirror_article(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.mirror(target_community, article, community_tags)
  end

  def unmirror_article(_root, ~m(target_community article)a, _info) do
    CMS.Articles.unmirror(target_community, article)
  end

  def move_article(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.move(target_community, article, community_tags)
  end

  def mirror_to_home(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.mirror_to_home(target_community, article, community_tags)
  end

  def move_to_blackhole(_root, ~m(target_community article community_tags)a, _info) do
    CMS.Articles.move_to_blackhole(target_community, article, community_tags)
  end

  # #######################
  # comments ..
  # #######################
  def comments_state(_root, ~m(thread id)a, %{context: %{cur_user: user}}) do
    CMS.comments_state(thread, id, user)
  end

  def comments_state(_root, ~m(thread id)a, _) do
    CMS.comments_state(thread, id)
  end

  def one_comment(_root, ~m(id)a, %{context: %{cur_user: user}}) do
    CMS.one_comment(id, user)
  end

  def one_comment(_root, ~m(id)a, _) do
    CMS.one_comment(id)
  end

  def paged_comments(_root, ~m(id thread filter mode)a, %{context: %{cur_user: user}}) do
    case mode do
      :replies -> CMS.paged_comments(thread, id, filter, :replies, user)
      :timeline -> CMS.paged_comments(thread, id, filter, :timeline, user)
    end
  end

  def paged_comments(_root, ~m(id thread filter mode)a, _info) do
    case mode do
      :replies -> CMS.paged_comments(thread, id, filter, :replies)
      :timeline -> CMS.paged_comments(thread, id, filter, :timeline)
    end
  end

  def paged_comments_participants(_root, ~m(id thread filter)a, _info) do
    CMS.paged_comments_participants(thread, id, filter)
  end

  def create_comment(_root, ~m(community thread id body)a, %{context: %{cur_user: user}}) do
    CMS.create_comment(community, thread, id, body, user)
  end

  def update_comment(_root, ~m(body comment)a, _info) do
    CMS.update_comment(comment, body)
  end

  def delete_comment(_root, ~m(comment)a, _info) do
    CMS.delete_comment(comment)
  end

  def reply_comment(_root, ~m(id body)a, %{context: %{cur_user: user}}) do
    CMS.reply_comment(id, body, user)
  end

  def upvote_comment(_root, ~m(id)a, %{context: %{cur_user: user}}) do
    CMS.upvote_comment(id, user)
  end

  def undo_upvote_comment(_root, ~m(id)a, %{context: %{cur_user: user}}) do
    CMS.undo_upvote_comment(id, user)
  end

  def emotion_to_comment(_root, ~m(id emotion)a, %{context: %{cur_user: user}}) do
    CMS.emotion_to_comment(id, emotion, user)
  end

  def undo_emotion_to_comment(_root, ~m(id emotion)a, %{context: %{cur_user: user}}) do
    CMS.undo_emotion_to_comment(id, emotion, user)
  end

  def mark_comment_solution(_root, ~m(id)a, %{context: %{cur_user: user}}) do
    CMS.mark_comment_solution(id, user)
  end

  def undo_mark_comment_solution(_root, ~m(id)a, %{context: %{cur_user: user}}) do
    CMS.undo_mark_comment_solution(id, user)
  end

  def pin_comment(_root, ~m(id)a, _info), do: CMS.pin_comment(id)

  def undo_pin_comment(_root, ~m(id)a, _info), do: CMS.undo_pin_comment(id)

  ############
  ############
  ############
  def paged_comment_replies(_root, ~m(id filter)a, %{context: %{cur_user: user}}) do
    CMS.paged_comment_replies(id, filter, user)
  end

  def paged_comment_replies(_root, ~m(id filter)a, _info) do
    CMS.paged_comment_replies(id, filter)
  end

  # #######################
  # sync github content ..
  # #######################
  def search_communities(_root, %{title: title, category: category}, %{context: %{cur_user: user}}) do
    CMS.search_communities(title, category, user)
  end

  def search_communities(_root, %{title: title, category: category}, _info) do
    CMS.search_communities(title, category)
  end

  def search_communities(_root, %{title: title}, %{context: %{cur_user: user}}) do
    CMS.search_communities(title, user)
  end

  def search_communities(_root, %{title: title}, _info) do
    CMS.search_communities(title)
  end

  def search_articles(_root, %{thread: thread, title: title}, _info) do
    CMS.search_articles(thread, %{title: title})
  end

  # ##############################################
  # counts just for manngers to use in admin site ..
  # ##############################################
  def threads_count(root, _, _), do: CMS.Communities.count(%Community{id: root.id}, :threads)

  def article_tags_count(root, _, _), do: CMS.Communities.count(%Community{id: root.id}, :article_tags)

  # OSS token
  def upload_tokens(_root, _, _) do
    CMS.upload_tokens()
  end
end
