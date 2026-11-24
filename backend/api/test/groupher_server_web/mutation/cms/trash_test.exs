defmodule GroupherServer.Test.Mutation.CMS.Trash do
  @moduledoc false

  use GroupherServer.TestMate

  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias CMS.Gate.ErrorCat, as: GateErrorCat

  alias GroupherServer.CMS
  alias CMS.Model.{Article, ArticleEmotionCount, ArticleStats, TrashedArticle}

  @throttle_interval CMS.Gate.RateLimit.Publish.Config.publish_throttle().interval_minutes

  setup do
    {community, post, _, owner} = mock_article(:post)
    guest_conn = simu_conn(:guest)
    owner_conn = simu_conn(:owner, post)

    {:ok, ~m(community post owner guest_conn owner_conn)a}
  end

  test "an Article owner moves it into Trash and restores it",
       ~m(community post owner_conn)a do
    variables = %{article: article_path(community, post, :post)}
    trashed = gq_mutation(owner_conn, S.Article.m(:trash_article), variables)

    assert trashed["thread"] == "POST"
    assert trashed["articleId"] == post.id
    assert trashed["article"]["innerId"] == to_string(article_inner_id(post, community))
    assert trashed["scheduledPermanentDeletionAt"]
    assert Repo.get(Article, post.id)
    assert {:error, _} = read_article(community, :post, article_inner_id(post, community))

    command_id = Ecto.UUID.generate()

    restored =
      gq_mutation(owner_conn, S.Article.m(:restore_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST",
        commandId: command_id
      })

    assert restored["innerId"] == to_string(article_inner_id(post, community))
    assert restored["commandId"] == command_id
    assert {:ok, _} = read_article(community, :post, article_inner_id(post, community))

    replayed =
      gq_mutation(owner_conn, S.Article.m(:restore_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST",
        commandId: command_id
      })

    assert replayed == restored
  end

  test "global Trash requires login and Article ownership",
       ~m(community post guest_conn)a do
    variables = %{article: article_path(community, post, :post)}
    schema = S.Article.m(:trash_article)

    assert guest_conn
           |> mutation_error?(
             schema,
             variables,
             ErrorCat.code(ProfileErrorCat.account_login())
           )

    unrelated =
      simu_conn(:user,
        passport: %{
          global: %{is_root: false, permissions: %{}},
          communities: %{community.slug => %{permissions: %{"post.pin" => true}}},
          community_permissions: %{}
        }
      )

    assert unrelated
           |> mutation_error?(
             schema,
             variables,
             ErrorCat.code(GateErrorCat.permission_denied())
           )

    admin =
      simu_conn(:user,
        passport: %{
          global: %{is_root: false, permissions: %{}},
          communities: %{
            community.slug => %{
              permissions: %{
                "community.article.hide" => true,
                "community.article.trash.read" => true
              }
            }
          },
          community_permissions: %{}
        }
      )

    assert admin
           |> mutation_error?(
             schema,
             variables,
             ErrorCat.code(GateErrorCat.permission_denied())
           )
  end

  test "a grant from another community cannot move this Article to Trash", ~m(owner)a do
    {:ok, community_a} = mock_community(owner)
    {:ok, community_b} = mock_community(owner)

    CMS.Gate.RateLimit.Publish.mock_publish_throttle_attr(
      :last_publish_time,
      owner,
      minutes: -@throttle_interval
    )

    {:ok, post_b} =
      GroupherServer.Support.Factory.create_published_article(
        community_b,
        :post,
        mock_attrs(:post),
        owner
      )

    conn =
      simu_conn(:user,
        passport: %{
          global: %{is_root: false, permissions: %{}},
          communities: %{
            community_a.slug => %{
              permissions: %{
                "community.article.hide" => true,
                "community.article.trash.read" => true
              }
            }
          },
          community_permissions: %{}
        }
      )

    variables = %{article: article_path(community_b, post_b, :post)}

    assert conn
           |> mutation_error?(
             S.Article.m(:trash_article),
             variables,
             ErrorCat.code(GateErrorCat.permission_denied())
           )

    assert {:ok, _} = read_article(community_b, :post, article_inner_id(post_b, community_b))
  end

  test "permanent deletion removes content but leaves the item queryable until that action",
       ~m(community post owner owner_conn)a do
    {:ok, _} = CMS.Interactions.emotion(post, :beer, owner, Ecto.UUID.generate())

    ArticleStats
    |> Repo.get_by!(thread: :post, article_id: post.id)
    |> Ecto.Changeset.change(views: 12, views_revision: 3)
    |> Repo.update!()

    trashed =
      gq_mutation(owner_conn, S.Article.m(:trash_article), %{
        article: article_path(community, post, :post)
      })

    {:ok, listed} = CMS.articles_list_trashed(community, %{thread: :post}, nil, owner)

    assert listed.total_count == 1
    assert hd(listed.entries).article.inner_id == article_inner_id(post, community)

    assert hd(listed.entries).article.article_stats
           |> Map.take([:views, :views_revision, :upvotes_count, :comments_count]) == %{
             views: 12,
             views_revision: 3,
             upvotes_count: 0,
             comments_count: 0
           }

    permanent_conn =
      simu_conn(:user, owner,
        passport: %{
          global: %{is_root: false, permissions: %{}},
          communities: %{
            community.slug => %{
              permissions: %{
                "community.article.hide" => true,
                "community.article.trash.read" => true
              }
            }
          },
          community_permissions: %{}
        }
      )

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
