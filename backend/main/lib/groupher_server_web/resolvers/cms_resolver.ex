defmodule GroupherServerWeb.Resolvers.CMS do
  @moduledoc false

  import ShortMaps
  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS}

  alias Helper.{ORM, OgInfo, Constant}
  alias Accounts.Model.User
  alias CMS.Model.{Community, Category, Thread}

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()
  # #######################
  # community ..
  # #######################
  def community(_root, %{slug: slug, inc_views: inc_views}, %{context: %{cur_user: user}}) do
    CMS.read_community(slug, user, inc_views: inc_views)
  end

  def community(_root, %{slug: slug, inc_views: inc_views}, _info) do
    CMS.read_community(slug, inc_views: inc_views)
  end

  def paged_communities(_root, ~m(filter)a, %{context: %{cur_user: user}}) do
    CMS.paged_communities(filter, user)
  end

  def paged_communities(_root, ~m(filter)a, _info) do
    CMS.paged_communities(filter)
  end

  def create_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.create_community(args, user)
  end

  def update_community(_root, %{community: community} = args, _info) do
    CMS.update_community(community, args)
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

    CMS.update_dashboard(community, key, dashboard_args)
  end

  def open_graph_info(_root, %{url: url}, _info), do: OgInfo.get(url)

  def delete_community(_root, %{id: id}, _info), do: Community |> ORM.find_delete!(id)

  def apply_community(_root, args, %{context: %{cur_user: user}}) do
    CMS.apply_community(args, user)
  end

  def approve_community_apply(_root, %{community: community}, _) do
    CMS.approve_community_apply(community)
  end

  def deny_community_apply(_root, %{id: id}, _) do
    CMS.deny_community_apply(id)
  end

  def community_exist?(_root, %{slug: slug}, _) do
    CMS.community_exist?(slug)
  end

  def has_pending_community_apply?(_root, _, %{context: %{cur_user: user}}) do
    CMS.has_pending_community_apply?(user)
  end

  # #######################
  # community thread (post, job), login user should be logged
  # #######################
  def read_article(_root, %{community: community, thread: thread, id: id}, %{
        context: %{cur_user: user}
      }) do
    CMS.read_article(community, thread, id, user)
  end

  def read_article(_root, %{community: community, thread: thread, id: id}, _info) do
    CMS.read_article(community, thread, id)
  end

  def set_post_cat(_root, %{passport_source: post, cat: cat}, _info) do
    CMS.set_post_cat(post, Map.get(@article_cat, cat))
  end

  def set_post_state(_root, %{passport_source: post, state: state}, _info) do
    CMS.set_post_state(post, Map.get(@article_state, state))
  end

  def paged_articles(_root, ~m(thread filter)a, %{context: %{cur_user: user}}) do
    CMS.paged_articles(thread, filter, user)
  end

  def paged_articles(_root, ~m(thread filter)a, _info) do
    CMS.paged_articles(thread, filter)
  end

  def grouped_kanban_posts(_root, %{community: community}, _info) do
    CMS.grouped_kanban_posts(community)
  end

  def paged_kanban_posts(_root, %{community: community, filter: filter}, _info) do
    CMS.paged_kanban_posts(community, filter)
  end

  def paged_reports(_root, ~m(filter)a, _) do
    CMS.paged_reports(filter)
  end

  def create_article(_root, ~m(community thread)a = args, %{context: %{cur_user: user}}) do
    CMS.create_article(community, thread, args, user)
  end

  def update_article(_root, %{passport_source: article} = args, _info) do
    CMS.update_article(article, args)
  end

  def delete_article(_root, %{passport_source: article}, _info) do
    CMS.delete_article(article)
  end

  # #######################
  # article actions
  # #######################
  def pin_article(_root, ~m(community article)a, _info), do: CMS.pin_article(community, article)

  def undo_pin_article(_root, ~m(community article)a, _info) do
    CMS.undo_pin_article(community, article)
  end

  def mark_delete_article(_root, ~m(id thread)a, _info) do
    CMS.mark_delete_article(thread, id)
  end

  def batch_mark_delete_articles(_root, ~m(community thread ids)a, _info) do
    CMS.batch_mark_delete_articles(community, thread, ids)
  end

  def batch_undo_mark_delete_articles(_root, ~m(community thread ids)a, _info) do
    CMS.batch_undo_mark_delete_articles(community, thread, ids)
  end

  def undo_mark_delete_article(_root, ~m(id thread)a, _info) do
    CMS.undo_mark_delete_article(thread, id)
  end

  def report_article(_root, ~m(article reason attr)a, %{context: %{cur_user: user}}) do
    CMS.report_article(article, reason, attr, user)
  end

  def undo_report_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.undo_report_article(article, user)
  end

  def paged_citing_contents(_root, ~m(content id filter)a, _info) do
    CMS.paged_citing_contents(content, id, filter)
  end

  # #######################
  # thread reaction ..
  # #######################
  def lock_article_comments(_root, ~m(article)a, _info), do: CMS.lock_article_comments(article)

  def undo_lock_article_comments(_root, ~m(article)a, _info) do
    CMS.undo_lock_article_comments(article)
  end

  def sink_article(_root, ~m(article)a, _info), do: CMS.sink_article(article)
  def undo_sink_article(_root, ~m(article)a, _info), do: CMS.undo_sink_article(article)

  def upvote_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.upvote_article(article, user)
  end

  def undo_upvote_article(_root, ~m(article)a, %{context: %{cur_user: user}}) do
    CMS.undo_upvote_article(article, user)
  end

  def upvoted_users(_root, ~m(article filter)a, _info) do
    CMS.upvoted_users(article, filter)
  end

  def collected_users(_root, ~m(article filter)a, _info) do
    CMS.collected_users(article, filter)
  end

  def emotion_to_article(_root, ~m(article emotion)a, %{context: %{cur_user: user}}) do
    CMS.emotion_to_article(article, emotion, user)
  end

  def undo_emotion_to_article(_root, ~m(article emotion)a, %{context: %{cur_user: user}}) do
    CMS.undo_emotion_to_article(article, emotion, user)
  end

  # #######################
  # category ..
  # #######################
  def paged_categories(_root, ~m(filter)a, _info), do: Category |> ORM.find_all(filter)

  def create_category(_root, ~m(title slug)a, %{context: %{cur_user: user}}) do
    CMS.create_category(%{title: title, slug: slug}, user)
  end

  def delete_category(_root, %{id: id}, _info), do: Category |> ORM.find_delete!(id)

  def update_category(_root, ~m(id title)a, %{context: %{cur_user: _}}) do
    CMS.update_category(~m(%Category id title)a)
  end

  def set_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.set_category(community, %Category{id: category_id})
  end

  def unset_category(_root, ~m(community category_id)a, %{context: %{cur_user: _}}) do
    CMS.unset_category(community, %Category{id: category_id})
  end

  # #######################
  # thread ..
  # #######################
  def paged_threads(_root, ~m(filter)a, _info), do: Thread |> ORM.find_all(filter)

  def create_thread(_root, ~m(title slug index)a, _info),
    do: CMS.create_thread(~m(title slug index)a)

  def set_thread(_root, ~m(community thread)a, _info), do: CMS.set_thread(community, thread)

  def unset_thread(_root, ~m(community thread)a, _info), do: CMS.unset_thread(community, thread)

  # #######################
  # moderators ..
  # #######################
  def all_passport_rules(_root, _, _) do
    with {:ok, rules} <- CMS.all_passport_rules() do
      {:ok,
       %{
         root: Jason.encode!(rules.root),
         moderator: Jason.encode!(rules.moderator)
       }}
    end
  end

  def add_moderator(_root, ~m(community user role)a, %{context: %{cur_user: cur_user}}) do
    CMS.add_moderator(community, role, user, cur_user)
  end

  def remove_moderator(_root, ~m(community user)a, %{context: %{cur_user: cur_user}}) do
    with {:ok, target_user} <- ORM.find_user(user) do
      CMS.remove_moderator(community, %User{id: target_user.id}, cur_user)
    end
  end

  def update_moderator_passport(_root, ~m(community user rules)a, %{
        context: %{cur_user: cur_user}
      }) do
    with {:ok, target_user} <- ORM.find_user(user) do
      CMS.update_moderator_passport(community, rules, %User{id: target_user.id}, cur_user)
    end
  end

  def paged_community_moderators(_root, ~m(id filter)a, _info) do
    CMS.community_members(:moderators, %Community{id: id}, filter)
  end

  # #######################
  # geo infos ..
  # #######################
  def community_geo_info(_root, ~m(id)a, _info) do
    CMS.community_geo_info(%Community{id: id})
  end

  # #######################
  # tags ..
  # #######################
  def create_article_tag(_root, %{thread: thread, community: community} = args, %{
        context: %{cur_user: user}
      }) do
    CMS.create_article_tag(%Community{slug: community}, thread, args, user)
  end

  def update_article_tag(_root, %{id: id} = args, _info) do
    CMS.update_article_tag(id, args)
  end

  def delete_article_tag(_root, %{id: id}, _info) do
    CMS.delete_article_tag(id)
  end

  def set_article_tag(_root, ~m(article article_tag_id)a, _info) do
    CMS.set_article_tag(article, article_tag_id)
  end

  def unset_article_tag(_root, ~m(article article_tag_id)a, _info) do
    CMS.unset_article_tag(article, article_tag_id)
  end

  def paged_article_tags(_root, %{filter: filter}, _info) do
    CMS.paged_article_tags(filter)
  end

  def reindex_tags_in_group(_root, ~m(community thread group tags)a, _info) do
    CMS.reindex_tags_in_group(community, thread, group, tags)

    {:ok, %{done: true}}
  end

  # #######################
  # community subscribe ..
  # #######################
  def subscribe_community(_root, ~m(community)a, %{context: ~m(cur_user remote_ip)a}) do
    CMS.subscribe_community(community, cur_user, remote_ip)
  end

  def subscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    CMS.subscribe_community(community, cur_user)
  end

  def unsubscribe_community(_root, ~m(community)a, %{context: ~m(cur_user remote_ip)a}) do
    CMS.unsubscribe_community(community, cur_user, remote_ip)
  end

  def unsubscribe_community(_root, ~m(community)a, %{context: %{cur_user: cur_user}}) do
    CMS.unsubscribe_community(community, cur_user)
  end

  def paged_community_subscribers(_root, ~m(id filter)a, %{context: %{cur_user: cur_user}}) do
    CMS.community_members(:subscribers, %Community{id: id}, filter, cur_user)
  end

  def paged_community_subscribers(_root, ~m(id filter)a, _info) do
    CMS.community_members(:subscribers, %Community{id: id}, filter)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, %{context: %{cur_user: cur_user}}) do
    CMS.community_members(:subscribers, %Community{slug: community}, filter, cur_user)
  end

  def paged_community_subscribers(_root, ~m(community filter)a, _info) do
    CMS.community_members(:subscribers, %Community{slug: community}, filter)
  end

  def paged_community_subscribers(_root, _args, _info), do: {:error, "invalid args"}

  def mirror_article(_root, ~m(target_community article article_tags)a, _info) do
    CMS.mirror_article(target_community, article, article_tags)
  end

  def unmirror_article(_root, ~m(target_community article)a, _info) do
    CMS.unmirror_article(target_community, article)
  end

  def move_article(_root, ~m(target_community article article_tags)a, _info) do
    CMS.move_article(target_community, article, article_tags)
  end

  def mirror_to_home(_root, ~m(target_community article article_tags)a, _info) do
    CMS.mirror_to_home(target_community, article, article_tags)
  end

  def move_to_blackhole(_root, ~m(target_community article article_tags)a, _info) do
    CMS.move_to_blackhole(target_community, article, article_tags)
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

  def update_comment(_root, ~m(body passport_source)a, _info) do
    comment = passport_source
    CMS.update_comment(comment, body)
  end

  def delete_comment(_root, ~m(passport_source)a, _info) do
    comment = passport_source
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
  def threads_count(root, _, _), do: CMS.count(%Community{id: root.id}, :threads)

  def article_tags_count(root, _, _), do: CMS.count(%Community{id: root.id}, :article_tags)

  # OSS token
  def upload_tokens(_root, _, _) do
    CMS.upload_tokens()
  end

  def client_i18n(_root, _, _) do
    {:ok, %{locale: "__ignore_this__"}}
  end
end
