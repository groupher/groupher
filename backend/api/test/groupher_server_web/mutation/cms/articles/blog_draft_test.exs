defmodule GroupherServer.Test.Mutation.Articles.BlogDraft do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS
  alias CMS.Passport.ErrorCat

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, user: user, user_conn: simu_conn(:user, user), community: community}
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
      read_article(context.community, :blog, result["innerId"])

    assert public_blog.stage == :public

    updated =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article, :blog), %{
        article: %{inner_id: result["innerId"], community: context.community.slug, thread: "BLOG"},
        expectedVersion: public_blog.version,
        title: "Republished Blog",
        body: mock_rich_text("republished blog")
      })

    assert updated["title"] == "Republished Blog"

    assert {:error, :not_found} =
             CMS.Articles.read_draft(public_blog.id, context.user, community: context.community)
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

    assert {:ok, stored_draft} =
             CMS.Articles.read_draft(draft["id"], context.user, community: context.community)

    assert stored_draft.title == "Blog Draft"

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
        id: draft["id"],
        expectedVersion: updated["version"],
        expectedLifecycleVersion: 1
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
             ErrorCat.code(ErrorCat.passport())
           )

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:publish_article_draft, :blog),
             %{
               community: context.community.slug,
               id: draft["id"],
               expectedVersion: draft["version"],
               expectedLifecycleVersion: 1
             },
             ErrorCat.code(ErrorCat.passport())
           )

    assert {:ok, stored_draft} =
             CMS.Articles.read_draft(draft["id"], context.user, community: context.community)

    assert stored_draft.title == "Author Blog Draft"
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
      read_article(context.community, :blog, published["innerId"])

    privileged_non_author =
      simu_conn(:user,
        cms: %{
          context.community.slug => %{"root" => true, "blog.edit" => true}
        }
      )

    variables = %{
      community: context.community.slug,
      id: public_blog.id,
      expectedVersion: public_blog.version,
      title: "First Blog Draft",
      body: mock_rich_text("unauthorized first draft")
    }

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:update_article_draft, :blog),
             variables,
             ErrorCat.code(ErrorCat.passport())
           )

    owner_draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article, :blog), %{
        article: %{
          inner_id: public_blog.inner_id,
          community: context.community.slug,
          thread: "BLOG"
        },
        expectedVersion: public_blog.version,
        title: variables.title,
        body: variables.body
      })

    assert owner_draft["title"] == "First Blog Draft"
  end
end
