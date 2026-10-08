defmodule GroupherServer.Test.Mutation.CMS.Trash do
  @moduledoc false

  use GroupherServer.TestMate

  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias CMS.Passport.ErrorCat, as: PassportErrorCat

  alias GroupherServer.CMS
  alias CMS.Model.{Article, ArticleEmotionCount, ArticleStats, TrashedArticle}

  setup do
    {community, post, _, owner} = mock_article(:post)
    guest_conn = simu_conn(:guest)
    owner_conn = simu_conn(:owner, post)

    {:ok, ~m(community post owner guest_conn owner_conn)a}
  end

  test "owner moves an Article into Trash and a moderator restores it",
       ~m(community post owner_conn)a do
    variables = %{article: article_path(community, post, :post)}
    trashed = gq_mutation(owner_conn, S.Article.m(:trash_article), variables)

    assert trashed["thread"] == "POST"
    assert trashed["articleId"] == post.id
    assert trashed["article"]["innerId"] == to_string(article_inner_id(post, community))
    assert trashed["scheduledPermanentDeletionAt"]
    assert Repo.get(Article, post.id)
    assert {:error, _} = read_article(community, :post, article_inner_id(post, community))

    rule_conn =
      simu_conn(:user, cms: %{community.slug => %{"post.restore" => true}})

    command_id = Ecto.UUID.generate()

    restored =
      gq_mutation(rule_conn, S.Article.m(:restore_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST",
        commandId: command_id
      })

    assert restored["innerId"] == to_string(article_inner_id(post, community))
    assert restored["commandId"] == command_id
    assert {:ok, _} = read_article(community, :post, article_inner_id(post, community))

    replayed =
      gq_mutation(rule_conn, S.Article.m(:restore_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST",
        commandId: command_id
      })

    assert replayed == restored
  end

  test "Trash requires login and either ownership or the thread grant",
       ~m(community post guest_conn)a do
    variables = %{article: article_path(community, post, :post)}
    schema = S.Article.m(:trash_article)

    assert guest_conn
           |> mutation_error?(
             schema,
             variables,
             ErrorCat.code(ProfileErrorCat.account_login())
           )

    unrelated = simu_conn(:user, cms: %{community.slug => %{"post.edit" => true}})

    assert unrelated
           |> mutation_error?(
             schema,
             variables,
             ErrorCat.code(PassportErrorCat.passport())
           )

    moderator = simu_conn(:user, cms: %{community.slug => %{"post.trash" => true}})
    assert gq_mutation(moderator, schema, variables)["id"]
  end

  test "a grant from another community cannot move this Article to Trash", ~m(owner)a do
    {:ok, community_a} = mock_community(owner)
    {:ok, community_b} = mock_community(owner)
    {:ok, post_b} = CMS.Articles.create(community_b, :post, mock_attrs(:post), owner)

    conn = simu_conn(:user, cms: %{community_a.slug => %{"post.trash" => true}})
    variables = %{article: article_path(community_b, post_b, :post)}

    assert conn
           |> mutation_error?(
             S.Article.m(:trash_article),
             variables,
             ErrorCat.code(PassportErrorCat.passport())
           )

    assert {:ok, _} = read_article(community_b, :post, article_inner_id(post_b, community_b))
  end

  test "permanent deletion removes content but leaves the item queryable until that action",
       ~m(community post owner owner_conn)a do
    {:ok, _} = CMS.Interactions.emotion(post, :beer, owner)

    ArticleStats
    |> Repo.get_by!(thread: :post, article_id: post.id)
    |> Ecto.Changeset.change(views: 12, views_revision: 3)
    |> Repo.update!()

    trashed =
      gq_mutation(owner_conn, S.Article.m(:trash_article), %{
        article: article_path(community, post, :post)
      })

    reader = simu_conn(:user, cms: %{community.slug => %{"post.trash" => true}})

    listed =
      gq_query(
        reader,
        S.Article.q(:trashed_articles),
        %{
          community: community.slug,
          thread: "POST",
          filter: %{page: 1, size: 20}
        }
      )

    assert listed["totalCount"] == 1
    assert hd(listed["entries"])["mentionedByCount"] == 0
    assert hd(listed["entries"])["article"]["innerId"] == to_string(article_inner_id(post, community))

    assert hd(listed["entries"])["article"]["articleStats"]
           |> Map.take(["views", "viewsRevision", "upvotesCount", "commentsCount"]) == %{
             "views" => 12,
             "viewsRevision" => 3,
             "upvotesCount" => 0,
             "commentsCount" => 0
           }

    permanent_conn =
      simu_conn(:user, owner, cms: %{community.slug => %{"post.permanent_delete" => true}})

    command_id = Ecto.UUID.generate()

    result =
      gq_mutation(permanent_conn, S.Article.m(:permanently_delete_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST",
        commandId: command_id
      })

    assert result["done"]
    assert result["commandId"] == command_id
    refute Repo.get(Article, post.id)
    refute Repo.get_by(ArticleStats, thread: :post, article_id: post.id)
    refute Repo.get_by(ArticleEmotionCount, thread: :post, article_id: post.id)
    refute Repo.get_by(TrashedArticle, hash_id: trashed["id"])

    replayed =
      gq_mutation(permanent_conn, S.Article.m(:permanently_delete_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST",
        commandId: command_id
      })

    assert replayed == result
  end
end
