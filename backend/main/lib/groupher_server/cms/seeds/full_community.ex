defmodule GroupherServer.CMS.Seeds.FullCommunity do
  @moduledoc false

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.CMS.Seeds.{Articles, Communities, Config, Tags}

  alias CMS.Model.{
    ArticleUpvote,
    ArticleUserEmotion,
    Changelog,
    Comment,
    CommentReply,
    CommentUpvote,
    CommentUserEmotion,
    Community,
    CommunityCategory,
    CommunityDashboard,
    CommunityJoinChangelog,
    CommunityJoinDoc,
    CommunityJoinPost,
    CommunityJoinTag,
    CommunityModerator,
    CommunitySubscriber,
    CommunityTag,
    CommunityThread,
    Doc,
    PinnedArticle,
    PinnedComment,
    Post
  }

  alias Helper.{ORM, T}

  @tag_threads Config.tag_threads()
  @content_threads Config.content_threads()
  @post_cats [:feature, :bug, :question, :other]
  @post_states [:backlog, :todo, :wip, :done, :resolved, :reject]

  @tag_count_range Config.tag_count_range()
  @article_count_per_thread Config.article_count_per_thread()
  @comment_count_range Config.comment_count_range()
  @article_upvotes_range Config.article_upvotes_range()
  @comment_upvotes_range Config.comment_upvotes_range()
  @comment_replies_range Config.comment_replies_range()

  @spec mock(String.t() | atom()) :: T.domain_res(map())
  def mock(slug), do: mock(slug, [])

  @spec mock(String.t() | atom(), keyword()) :: T.domain_res(map())
  def mock(slug, opts) when is_list(opts) do
    case Keyword.keyword?(opts) do
      true ->
        with {:ok, community} <- Communities.mock(slug),
             {:ok, _} <- seed_about_dashboard(community, slug),
             {:ok, posts} <- seed_threads(community, opts),
             {:ok, _} <- seed_post_states_and_cats(posts),
             {:ok, updated_community} <- CMS.Communities.read(community.slug, inc_views: false) do
          {:ok, updated_community}
        end

      false ->
        {:error, {:invalid_opts, "full_community mock opts must be a keyword list"}}
    end
  end

  def mock(_slug, _opts),
    do: {:error, {:invalid_opts, "full_community mock opts must be a keyword list"}}

  @spec delete(String.t() | atom()) :: T.domain_res(:ok)
  def delete(slug) do
    with {:ok, community} <- ORM.find_by(Community, %{slug: to_string(slug)}),
         {post_ids, changelog_ids, doc_ids} <- article_ids(community),
         comment_ids <- comments_ids(post_ids, changelog_ids, doc_ids),
         {:ok, _} <- delete_comment_relations(comment_ids),
         {:ok, _} <- delete_article_relations(post_ids, changelog_ids, doc_ids),
         {:ok, _} <- delete_tag_relations(community.id),
         {:ok, _} <- delete_community_relations(community.id),
         {_count, _} <- delete_all(from(c in Community, where: c.id == ^community.id)) do
      {:ok, :ok}
    end
  end

  defp seed_threads(community, opts) do
    tag_count_range = Keyword.get(opts, :tag_count_range, @tag_count_range)

    article_count_per_thread =
      Keyword.get(opts, :article_count_per_thread, @article_count_per_thread)

    comment_count_range =
      case Keyword.get(opts, :comment_count_range) do
        {min, max} when is_integer(min) and is_integer(max) and min <= max ->
          {min, max}

        _ ->
          comment_count_per_article = Keyword.get(opts, :comment_count_per_article)

          case comment_count_per_article do
            count when is_integer(count) and count >= 0 -> {count, count}
            _ -> @comment_count_range
          end
      end

    article_upvotes_range = Keyword.get(opts, :article_upvotes_range, @article_upvotes_range)
    comment_upvotes_range = Keyword.get(opts, :comment_upvotes_range, @comment_upvotes_range)
    comment_replies_range = Keyword.get(opts, :comment_replies_range, @comment_replies_range)

    tags_by_thread =
      Enum.reduce(@tag_threads, %{}, fn thread, acc ->
        {:ok, tag_ids} = Tags.mock(community, thread, count: random_range(tag_count_range))
        Map.put(acc, thread, tag_ids)
      end)

    posts =
      Enum.reduce(@content_threads, [], fn thread, acc ->
        {:ok, articles} =
          Articles.mock(
            community,
            thread,
            count_range: {article_count_per_thread, article_count_per_thread},
            upvotes_range: article_upvotes_range,
            comment_range: comment_count_range,
            comment_upvotes_range: comment_upvotes_range,
            replies_range: comment_replies_range,
            tag_ids: Map.get(tags_by_thread, thread, [])
          )

        case thread do
          :post -> acc ++ articles
          _ -> acc
        end
      end)

    {:ok, posts}
  end

  defp seed_post_states_and_cats(posts) when is_list(posts) do
    post_modes =
      posts
      |> Enum.shuffle()
      |> Enum.with_index()
      |> Enum.map(fn {_post, idx} ->
        case idx do
          0 -> :none
          1 -> :cat_only
          2 -> :cat_and_state
          _ -> Enum.random([:none, :cat_and_state, :cat_and_state, :cat_only])
        end
      end)

    posts
    |> Enum.zip(post_modes)
    |> Enum.reduce_while({:ok, :ok}, fn {post, mode}, _acc ->
      case mode do
        :none ->
          {:cont, {:ok, :ok}}

        :cat_only ->
          case CMS.Articles.set_cat(post, Enum.random(@post_cats)) do
            {:ok, _} -> {:cont, {:ok, :ok}}
            {:error, reason} -> {:halt, {:error, reason}}
          end

        :cat_and_state ->
          with {:ok, post} <- CMS.Articles.set_cat(post, Enum.random(@post_cats)),
               {:ok, _post} <- CMS.Articles.set_state(post, Enum.random(@post_states)) do
            {:cont, {:ok, :ok}}
          else
            {:error, reason} -> {:halt, {:error, reason}}
          end
      end
    end)
  end

  defp seed_about_dashboard(community, slug) do
    slug = to_string(slug)

    with {:ok, _} <-
           CMS.Communities.update_dashboard(community, :enable, %{
             about: true,
             about_techstack: true,
             about_location: true,
             about_links: true,
             about_media_report: true,
             post: true,
             changelog: true,
             kanban: true,
             doc: true
           }),
         {:ok, _} <-
           CMS.Communities.update_dashboard(community, :base_info, %{
             title: String.capitalize(slug),
             slug: slug,
             desc: "#{slug} community",
             homepage: "https://#{slug}.example.com",
             introduction: "Built with seed data for QA and showcase.",
             city: "Shanghai,Singapore,Berlin",
             techstack: "Elixir,Phoenix,PostgreSQL,TypeScript,React"
           }),
         {:ok, _} <-
           CMS.Communities.update_dashboard(community, :social_links, [
             %{type: "github", link: "https://github.com/#{slug}"},
             %{type: "twitter", link: "https://x.com/#{slug}"},
             %{type: "website", link: "https://#{slug}.example.com"}
           ]),
         {:ok, _} <-
           CMS.Communities.update_dashboard(community, :media_reports, [
             %{
               index: 0,
               title: "#{String.capitalize(slug)} announced",
               site_name: "Groupher Weekly",
               favicon: "https://groupher.com/favicon.ico",
               url: "https://news.example.com/#{slug}/announce"
             },
             %{
               index: 1,
               title: "#{String.capitalize(slug)} product deep dive",
               site_name: "Tech Radar",
               favicon: "https://techradar.example.com/favicon.ico",
               url: "https://techradar.example.com/#{slug}/deep-dive"
             }
           ]) do
      {:ok, :ok}
    end
  end

  defp article_ids(%Community{id: community_id, slug: community_slug}) do
    post_ids =
      Repo.all(
        from(p in Post,
          where: p.community_id == ^community_id or p.community_slug == ^community_slug,
          select: p.id
        )
      )

    changelog_ids =
      Repo.all(
        from(c in Changelog,
          where: c.community_id == ^community_id or c.community_slug == ^community_slug,
          select: c.id
        )
      )

    doc_ids =
      Repo.all(
        from(d in Doc,
          where: d.community_id == ^community_id or d.community_slug == ^community_slug,
          select: d.id
        )
      )

    {post_ids, changelog_ids, doc_ids}
  end

  defp comments_ids(post_ids, changelog_ids, doc_ids) do
    Repo.all(
      from(c in Comment,
        where: c.post_id in ^post_ids or c.changelog_id in ^changelog_ids or c.doc_id in ^doc_ids,
        select: c.id
      )
    )
  end

  defp delete_comment_relations(comment_ids) do
    delete_all(
      from(c in CommentReply,
        where: c.comment_id in ^comment_ids or c.reply_to_id in ^comment_ids
      )
    )

    delete_all(from(c in CommentUpvote, where: c.comment_id in ^comment_ids))
    delete_all(from(c in CommentUserEmotion, where: c.comment_id in ^comment_ids))
    delete_all(from(c in PinnedComment, where: c.comment_id in ^comment_ids))
    delete_all(from(c in Comment, where: c.id in ^comment_ids))

    {:ok, :ok}
  end

  defp delete_article_relations(post_ids, changelog_ids, doc_ids) do
    delete_all(
      from(a in ArticleUpvote,
        where: a.post_id in ^post_ids or a.changelog_id in ^changelog_ids or a.doc_id in ^doc_ids
      )
    )

    delete_all(
      from(a in ArticleUserEmotion,
        where: a.post_id in ^post_ids or a.changelog_id in ^changelog_ids or a.doc_id in ^doc_ids
      )
    )

    delete_all(
      from(c in CommunityJoinTag,
        where: c.post_id in ^post_ids or c.changelog_id in ^changelog_ids or c.doc_id in ^doc_ids
      )
    )

    delete_all(
      from(p in PinnedArticle,
        where: p.post_id in ^post_ids or p.changelog_id in ^changelog_ids or p.doc_id in ^doc_ids
      )
    )

    delete_all(from(c in CommunityJoinPost, where: c.post_id in ^post_ids))
    delete_all(from(c in CommunityJoinChangelog, where: c.changelog_id in ^changelog_ids))
    delete_all(from(c in CommunityJoinDoc, where: c.doc_id in ^doc_ids))

    delete_all(from(p in Post, where: p.id in ^post_ids))
    delete_all(from(c in Changelog, where: c.id in ^changelog_ids))
    delete_all(from(d in Doc, where: d.id in ^doc_ids))

    {:ok, :ok}
  end

  defp delete_tag_relations(community_id) do
    tag_ids =
      Repo.all(from(t in CommunityTag, where: t.community_id == ^community_id, select: t.id))

    delete_all(from(c in CommunityJoinTag, where: c.community_tag_id in ^tag_ids))
    delete_all(from(t in CommunityTag, where: t.id in ^tag_ids))

    {:ok, :ok}
  end

  defp delete_community_relations(community_id) do
    delete_all(from(c in CommunityDashboard, where: c.community_id == ^community_id))
    delete_all(from(c in CommunityThread, where: c.community_id == ^community_id))
    delete_all(from(c in CommunityCategory, where: c.community_id == ^community_id))
    delete_all(from(c in CommunitySubscriber, where: c.community_id == ^community_id))
    delete_all(from(c in CommunityModerator, where: c.community_id == ^community_id))
    delete_all(from(c in CommunityJoinPost, where: c.community_id == ^community_id))
    delete_all(from(c in CommunityJoinChangelog, where: c.community_id == ^community_id))
    delete_all(from(c in CommunityJoinDoc, where: c.community_id == ^community_id))

    {:ok, :ok}
  end

  defp random_range({min, max}) when is_integer(min) and is_integer(max) and min <= max,
    do: Enum.random(min..max)

  defp random_range(_), do: 10

  defp delete_all(query), do: Repo.delete_all(query, timeout: 300_000)
end
