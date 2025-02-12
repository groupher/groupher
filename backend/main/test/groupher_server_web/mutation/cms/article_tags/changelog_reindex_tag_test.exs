defmodule GroupherServer.Test.Mutation.ArticleTags.ChangelogReindexTag do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.ArticleTag
  alias Helper.ORM

  setup do
    {:ok, changelog} = db_insert(:changelog)
    {:ok, user} = db_insert(:user)
    {:ok, community} = db_insert(:community)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, changelog)

    article_tag_attrs = mock_attrs(:article_tag)

    {:ok, ~m(user_conn guest_conn owner_conn community changelog article_tag_attrs user)a}
  end

  describe "[mutation changelog tag]" do
    @query """
    mutation($community: String!, $thread: Thread, $group: String!, $tags: [ArticleTagIndex]) {
      reindexTagsInGroup(community: $community, thread: $thread, group: $group, tags: $tags) {
        done
      }
    }
    """

    test "auth user can reindex tags in given group", ~m(community article_tag_attrs user)a do
      attrs = Map.merge(article_tag_attrs, %{group: "group1"})

      {:ok, article_tag1} = CMS.create_article_tag(community, :changelog, attrs, user)
      {:ok, article_tag2} = CMS.create_article_tag(community, :changelog, attrs, user)
      {:ok, article_tag3} = CMS.create_article_tag(community, :changelog, attrs, user)
      {:ok, article_tag4} = CMS.create_article_tag(community, :changelog, attrs, user)

      passport_rules = %{community.title => %{"changelog.article_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        community: community.slug,
        thread: "CHANGELOG",
        group: "group1",
        tags: [
          %{
            id: article_tag1.id,
            index: 1
          },
          %{
            id: article_tag2.id,
            index: 2
          },
          %{
            id: article_tag3.id,
            index: 3
          },
          %{
            id: article_tag4.id,
            index: 4
          }
        ]
      }

      rule_conn |> mutation_result(@query, variables, "reindexTagsInGroup")

      {:ok, article_tag1_after} = ORM.find(ArticleTag, article_tag1.id)
      {:ok, article_tag2_after} = ORM.find(ArticleTag, article_tag2.id)
      {:ok, article_tag3_after} = ORM.find(ArticleTag, article_tag3.id)
      {:ok, article_tag4_after} = ORM.find(ArticleTag, article_tag4.id)

      assert article_tag1_after.index === 1
      assert article_tag2_after.index === 2
      assert article_tag3_after.index === 3
      assert article_tag4_after.index === 4
    end
  end
end
