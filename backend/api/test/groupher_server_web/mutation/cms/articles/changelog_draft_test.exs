defmodule GroupherServer.Test.Mutation.Articles.ChangelogDraft do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS
  alias CMS.Passport.ErrorCat

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    {:ok, user: user, user_conn: simu_conn(:user, user), community: community}
  end

  test "default Changelog creation publishes through the revision lifecycle", context do
    result =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article, :changelog), %{
        community: context.community.slug,
        title: "Published Changelog",
        body: mock_rich_text("published changelog")
      })

    {:ok, public_changelog} =
      read_article(context.community, :changelog, result["innerId"])

    assert public_changelog.stage == :public

    updated =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article, :changelog), %{
        article: %{
          inner_id: result["innerId"],
          community: context.community.slug,
          thread: "CHANGELOG"
        },
        expectedVersion: public_changelog.version,
        title: "Republished Changelog",
        body: mock_rich_text("republished changelog")
      })

    assert updated["title"] == "Republished Changelog"

    assert {:error, :not_found} =
             CMS.Articles.read_draft(public_changelog.id, context.user,
               community: context.community
             )
  end

  test "Changelog Draft stays private until its explicit publish mutation", context do
    draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article_draft, :changelog), %{
        community: context.community.slug,
        title: "Changelog Draft",
        body: mock_rich_text("changelog draft")
      })

    assert draft["stage"] == "DRAFT"
    assert draft["thread"] == "CHANGELOG"

    assert {:ok, stored_draft} =
             CMS.Articles.read_draft(draft["id"], context.user, community: context.community)

    assert stored_draft.title == "Changelog Draft"

    updated =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article_draft, :changelog), %{
        community: context.community.slug,
        id: draft["id"],
        expectedVersion: draft["version"],
        title: "Updated Changelog Draft",
        body: mock_rich_text("updated changelog draft")
      })

    assert updated["title"] == "Updated Changelog Draft"

    published =
      context.user_conn
      |> gq_mutation(S.Article.m(:publish_article_draft, :changelog), %{
        community: context.community.slug,
        id: draft["id"],
        expectedVersion: updated["version"],
        expectedLifecycleVersion: 1
      })

    assert published["innerId"]
    assert published["title"] == "Updated Changelog Draft"
  end

  test "only the Changelog Draft author can update or publish it", context do
    draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article_draft, :changelog), %{
        community: context.community.slug,
        title: "Author Changelog Draft",
        body: mock_rich_text("author changelog draft")
      })

    privileged_non_author =
      simu_conn(:user,
        cms: %{
          context.community.slug => %{"root" => true, "changelog.edit" => true}
        }
      )

    update_variables = %{
      community: context.community.slug,
      id: draft["id"],
      expectedVersion: draft["version"],
      title: "Unauthorized Changelog Draft",
      body: mock_rich_text("unauthorized changelog draft")
    }

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:update_article_draft, :changelog),
             update_variables,
             ErrorCat.code(ErrorCat.passport())
           )

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:publish_article_draft, :changelog),
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

    assert stored_draft.title == "Author Changelog Draft"
  end

  test "only the public Changelog author can start its first Draft", context do
    published =
      context.user_conn
      |> gq_mutation(S.Article.m(:create_article, :changelog), %{
        community: context.community.slug,
        title: "Public Changelog",
        body: mock_rich_text("public changelog")
      })

    {:ok, public_changelog} =
      read_article(context.community, :changelog, published["innerId"])

    privileged_non_author =
      simu_conn(:user,
        cms: %{
          context.community.slug => %{"root" => true, "changelog.edit" => true}
        }
      )

    variables = %{
      community: context.community.slug,
      id: public_changelog.id,
      expectedVersion: public_changelog.version,
      title: "First Changelog Draft",
      body: mock_rich_text("unauthorized first draft")
    }

    assert privileged_non_author
           |> mutation_error?(
             S.Article.m(:update_article_draft, :changelog),
             variables,
             ErrorCat.code(ErrorCat.passport())
           )

    owner_draft =
      context.user_conn
      |> gq_mutation(S.Article.m(:update_article, :changelog), %{
        article: %{
          inner_id: public_changelog.inner_id,
          community: context.community.slug,
          thread: "CHANGELOG"
        },
        expectedVersion: public_changelog.version,
        title: variables.title,
        body: variables.body
      })

    assert owner_draft["title"] == "First Changelog Draft"
  end
end
