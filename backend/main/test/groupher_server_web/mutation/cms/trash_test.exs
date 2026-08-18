defmodule GroupherServer.Test.Mutation.CMS.Trash do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Model.{Post, TrashedArticle}

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
    assert trashed["articleRef"] == post.article_hash_id
    assert trashed["article"]["innerId"] == to_string(post.inner_id)
    assert trashed["scheduledPermanentDeletionAt"]
    assert Repo.get(Post, post.id)
    assert {:error, _} = CMS.Articles.read(community, :post, post.inner_id)

    rule_conn =
      simu_conn(:user, cms: %{community.slug => %{"post.restore" => true}})

    restored =
      gq_mutation(rule_conn, S.Article.m(:restore_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST"
      })

    assert restored["innerId"] == to_string(post.inner_id)
    assert {:ok, _} = CMS.Articles.read(community, :post, post.inner_id)
  end

  test "Trash requires login and either ownership or the thread grant",
       ~m(community post guest_conn)a do
    variables = %{article: article_path(community, post, :post)}
    schema = S.Article.m(:trash_article)

    assert guest_conn
           |> mutation_error?(
             schema,
             variables,
             ErrorCat.code(GroupherServer.Accounts.Profiles.ErrorCat.account_login())
           )

    unrelated = simu_conn(:user, cms: %{community.slug => %{"post.edit" => true}})

    assert unrelated
           |> mutation_error?(
             schema,
             variables,
             ErrorCat.code(GroupherServer.CMS.Passport.ErrorCat.passport())
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
             ErrorCat.code(GroupherServer.CMS.Passport.ErrorCat.passport())
           )

    assert {:ok, _} = CMS.Articles.read(community_b, :post, post_b.inner_id)
  end

  test "community managers can page the append-only Audit log",
       ~m(community post owner_conn)a do
    trashed =
      gq_mutation(owner_conn, S.Article.m(:trash_article), %{
        article: article_path(community, post, :post)
      })

    manager = simu_conn(:user, cms: %{community.slug => %{"community.update" => true}})

    logs =
      gq_query(manager, S.Article.q(:cms_audit_logs), %{
        community: community.slug,
        filter: %{page: 1, size: 20, action: "article.trashed"}
      })

    assert logs["totalCount"] == 1
    [log] = logs["entries"]
    assert log["action"] == "article.trashed"
    assert log["resourceRef"] == post.article_hash_id
    assert log["operationRef"]
    assert log["operationRef"] != trashed["id"]
  end

  test "permanent deletion removes content but leaves the item queryable until that action",
       ~m(community post owner owner_conn)a do
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
    assert hd(listed["entries"])["article"]["innerId"] == to_string(post.inner_id)

    permanent_conn =
      simu_conn(:user, owner, cms: %{community.slug => %{"post.permanent_delete" => true}})

    result =
      gq_mutation(permanent_conn, S.Article.m(:permanently_delete_trashed_article), %{
        id: trashed["id"],
        community: community.slug,
        thread: "POST"
      })

    assert result["done"]
    refute Repo.get(Post, post.id)
    refute Repo.get_by(TrashedArticle, hash_id: trashed["id"])
  end
end
