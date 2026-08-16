defmodule GroupherServer.Test.Mutation.Articles.BlogDraft do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, user_conn: simu_conn(:user, user), community: community}
  end

  test "default Blog creation publishes through the revision lifecycle", context do
    result =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article, :blog), %{
        community: context.community.slug,
        title: "Published Blog",
        body: mock_rich_text("published blog")
      })

    {:ok, public_blog} =
      CMS.FrontDesk.article(context.community, :blog, result["innerId"])

    assert public_blog.stage == :public

    context.user_conn
    |> gq_mutation(S.Article.m(:update_article, :blog), %{
      article: %{inner_id: result["innerId"], community: context.community.slug, thread: "BLOG"},
      expectedVersion: public_blog.version,
      title: "Republished Blog",
      body: mock_rich_text("republished blog")
    })

    {:ok, draft} = CMS.Articles.read_draft(context.community, :blog, public_blog.article_hash_id)
    assert draft.title == "Republished Blog"

    {:ok, actor} = CMS.FrontDesk.author_of(public_blog)

    {:ok, %{article: published, snapshot: nil}} =
      CMS.Articles.publish_draft(context.community, :blog, public_blog.article_hash_id, actor)

    assert published.title == "Republished Blog"
  end

  test "Blog Draft stays private until its explicit publish mutation", context do
    draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article_draft, :blog), %{
        community: context.community.slug,
        title: "Blog Draft",
        body: mock_rich_text("blog draft")
      })

    assert draft["stage"] == "DRAFT"
    assert draft["thread"] == "BLOG"
    assert {:error, _} = CMS.Articles.read_public(context.community, :blog, draft["id"])

    updated =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article_draft, :blog), %{
        community: context.community.slug,
        id: draft["id"],
        expectedVersion: draft["version"],
        title: "Updated Blog Draft",
        body: mock_rich_text("updated blog draft")
      })

    assert updated["title"] == "Updated Blog Draft"

    published =
      context.user_conn
      |> gq_mutation(S.Article.m(:publish_article_draft, :blog), %{
        community: context.community.slug,
        id: draft["id"]
      })

    assert published["innerId"]
    assert published["title"] == "Updated Blog Draft"
  end

  test "only the Blog Draft author can update or publish it", context do
    draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article_draft, :blog), %{
        community: context.community.slug,
        title: "Author Blog Draft",
        body: mock_rich_text("author blog draft")
      })

    privileged_non_author =
      simu_conn(:user,
        cms: %{
          context.community.slug => %{"root" => true, "blog.edit" => true}
        }
      )

    update_variables = %{
      community: context.community.slug,
      id: draft["id"],
      expectedVersion: draft["version"],
      title: "Unauthorized Blog Draft",
      body: mock_rich_text("unauthorized blog draft")
    }

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:update_article_draft, :blog),
             update_variables,
             ecode(:passport)
           )

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:publish_article_draft, :blog),
             %{community: context.community.slug, id: draft["id"]},
             ecode(:passport)
           )

    assert {:ok, stored_draft} =
             CMS.Articles.read_draft(context.community, :blog, draft["id"])

    assert stored_draft.title == "Author Blog Draft"
    assert {:error, _} = CMS.Articles.read_public(context.community, :blog, draft["id"])
  end

  test "only the public Blog author can start its first Draft", context do
    published =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article, :blog), %{
        community: context.community.slug,
        title: "Public Blog",
        body: mock_rich_text("public blog")
      })

    {:ok, public_blog} =
      CMS.FrontDesk.article(context.community, :blog, published["innerId"])

    privileged_non_author =
      simu_conn(:user,
        cms: %{
          context.community.slug => %{"root" => true, "blog.edit" => true}
        }
      )

    variables = %{
      community: context.community.slug,
      id: public_blog.article_hash_id,
      expectedVersion: public_blog.version,
      title: "First Blog Draft",
      body: mock_rich_text("unauthorized first draft")
    }

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:update_article_draft, :blog),
             variables,
             ecode(:passport)
           )

    owner_draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article_draft, :blog), variables)

    assert owner_draft["title"] == "First Blog Draft"
  end
end
