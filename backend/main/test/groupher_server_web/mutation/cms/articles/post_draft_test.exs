defmodule GroupherServer.Test.Mutation.Articles.PostDraft do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, user_conn: simu_conn(:user, user), community: community}
  end

  test "default Post creation publishes through the revision lifecycle", context do
    result =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article, :post), %{
        community: context.community.slug,
        title: "Published Post",
        body: mock_rich_text("published post")
      })

    {:ok, public_post} =
      CMS.FrontDesk.article(context.community, :post, result["innerId"])

    assert public_post.stage == :public

    assert {:ok, [%{action: :publish, stage: :public}]} =
             CMS.Articles.list_snapshots(
               context.community,
               :post,
               public_post.article_hash_id
             )

    context.user_conn
    |> gq_mutation(S.Article.m(:update_article, :post), %{
      article: %{inner_id: result["innerId"], community: context.community.slug, thread: "POST"},
      title: "Republished Post",
      body: mock_rich_text("republished post")
    })

    assert {:ok, [latest, first]} =
             CMS.Articles.list_snapshots(context.community, :post, public_post.article_hash_id)

    assert {latest.action, first.action} == {:publish, :publish}
  end

  test "Post Draft stays private until its explicit publish mutation", context do
    draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article_draft, :post), %{
        community: context.community.slug,
        title: "Post Draft",
        body: mock_rich_text("post draft")
      })

    assert draft["stage"] == "DRAFT"
    assert draft["thread"] == "POST"
    assert {:error, _} = CMS.Articles.read_public(context.community, :post, draft["id"])

    updated =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article_draft, :post), %{
        community: context.community.slug,
        id: draft["id"],
        title: "Updated Post Draft",
        body: mock_rich_text("updated post draft")
      })

    assert updated["title"] == "Updated Post Draft"

    published =
      context.user_conn
      |> gq_mutation(S.Article.m(:publish_article_draft, :post), %{
        community: context.community.slug,
        id: draft["id"]
      })

    assert published["innerId"]
    assert published["title"] == "Updated Post Draft"
  end

  test "only the Post Draft author can update or publish it", context do
    draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article_draft, :post), %{
        community: context.community.slug,
        title: "Author Post Draft",
        body: mock_rich_text("author post draft")
      })

    privileged_non_author =
      simu_conn(:user,
        cms: %{
          context.community.slug => %{"root" => true, "post.edit" => true}
        }
      )

    update_variables = %{
      community: context.community.slug,
      id: draft["id"],
      title: "Unauthorized Post Draft",
      body: mock_rich_text("unauthorized post draft")
    }

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:update_article_draft, :post),
             update_variables,
             ecode(:passport)
           )

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:publish_article_draft, :post),
             %{community: context.community.slug, id: draft["id"]},
             ecode(:passport)
           )

    assert {:ok, stored_draft} =
             CMS.Articles.read_draft(context.community, :post, draft["id"])

    assert stored_draft.title == "Author Post Draft"
    assert {:error, _} = CMS.Articles.read_public(context.community, :post, draft["id"])
  end

  test "only the public Post author can start its first Draft", context do
    published =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article, :post), %{
        community: context.community.slug,
        title: "Public Post",
        body: mock_rich_text("public post")
      })

    {:ok, public_post} =
      CMS.FrontDesk.article(context.community, :post, published["innerId"])

    privileged_non_author =
      simu_conn(:user,
        cms: %{
          context.community.slug => %{"root" => true, "post.edit" => true}
        }
      )

    variables = %{
      community: context.community.slug,
      id: public_post.article_hash_id,
      title: "First Post Draft",
      body: mock_rich_text("unauthorized first draft")
    }

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:update_article_draft, :post),
             variables,
             ecode(:passport)
           )

    owner_draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article_draft, :post), variables)

    assert owner_draft["title"] == "First Post Draft"
  end
end
