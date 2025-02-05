defmodule GroupherServer.Test.Mutation.CMS.ArticleArticleTags.DocTagCRUD do
  @moduledoc false

  use GroupherServer.TestTools

  alias GroupherServer.CMS
  alias CMS.Model.ArticleTag

  alias Helper.ORM

  setup do
    {:ok, community} = db_insert(:community)
    {:ok, thread} = db_insert(:thread)
    {:ok, user} = db_insert(:user)

    article_tag_attrs = mock_attrs(:article_tag)

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community thread user article_tag_attrs)a}
  end

  describe "[mutation cms tag]" do
    @create_tag_query """
    mutation($thread: Thread!, $title: String!, $slug: String!, $color: RainbowColor!, $group: String, $community: String!, $extra: [String] ) {
      createArticleTag(thread: $thread, title: $title, slug: $slug, color: $color, group: $group, community: $community, extra: $extra) {
        id
        title
        color
        thread
        group
        extra
        community {
          id
          logo
          title
        }
      }
    }
    """

    test "create tag with valid attrs, has default DOC thread and default docs",
         ~m(community)a do
      variables = %{
        title: "tag title",
        slug: "tag_raw",
        community: community.slug,
        thread: "DOC",
        color: "GREEN",
        group: "awesome"
      }

      passport_rules = %{community.title => %{"doc.article_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> mutation_result(@create_tag_query, variables, "createArticleTag")

      belong_community = created["community"]

      {:ok, found} = ArticleTag |> ORM.find(created["id"])

      assert created["id"] == to_string(found.id)
      assert found.thread == "DOC"
      assert found.group == "awesome"
      assert belong_community["id"] == to_string(community.id)
    end

    test "create tag with extra", ~m(community)a do
      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "DOC",
        color: "GREEN",
        group: "awesome",
        extra: ["menuID", "menuID2"]
      }

      passport_rules = %{community.title => %{"doc.article_tag.create" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      created = rule_conn |> mutation_result(@create_tag_query, variables, "createArticleTag")

      assert created["extra"] == ["menuID", "menuID2"]
    end

    test "unauth user create tag fails", ~m(community user_conn guest_conn)a do
      variables = %{
        title: "tag title",
        slug: "tag",
        community: community.slug,
        thread: "DOC",
        color: "GREEN"
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@create_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@create_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_get_error?(@create_tag_query, variables, ecode(:passport))
    end

    @update_tag_query """
    mutation($id: ID!, $color: RainbowColor, $title: String, $slug: String, $community: String!, $thread: Thread, $extra: [String], $icon: String) {
      updateArticleTag(id: $id, color: $color, title: $title, slug: $slug, community: $community, thread: $thread, extra: $extra, icon: $icon) {
        id
        title
        color
        extra
        icon
      }
    }
    """

    test "auth user can update a tag", ~m(article_tag_attrs community user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :doc, article_tag_attrs, user)

      variables = %{
        id: article_tag.id,
        color: "YELLOW",
        title: "new title",
        slug: "new_title",
        community: community.slug,
        extra: ["newMenuID"],
        icon: "icon",
        thread: "DOC"
      }

      passport_rules = %{community.title => %{"doc.article_tag.update" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> mutation_result(@update_tag_query, variables, "updateArticleTag")

      assert updated["color"] == "YELLOW"
      assert updated["title"] == "new title"
      assert updated["extra"] == ["newMenuID"]
      assert updated["icon"] == "icon"
    end

    @delete_tag_query """
    mutation($id: ID!, $community: String!, $thread: Thread){
      deleteArticleTag(id: $id, community: $community, thread: $thread) {
        id
      }
    }
    """

    test "auth user can delete tag", ~m(article_tag_attrs community user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :doc, article_tag_attrs, user)

      variables = %{id: article_tag.id, community: community.slug, thread: "DOC"}

      rule_conn =
        simu_conn(:user,
          cms: %{community.title => %{"doc.article_tag.delete" => true}}
        )

      deleted = rule_conn |> mutation_result(@delete_tag_query, variables, "deleteArticleTag")

      assert deleted["id"] == to_string(article_tag.id)
    end

    test "unauth user delete tag fails",
         ~m(article_tag_attrs community user_conn guest_conn user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :doc, article_tag_attrs, user)

      variables = %{id: article_tag.id, community: community.slug}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn |> mutation_get_error?(@delete_tag_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@delete_tag_query, variables, ecode(:account_login))

      assert rule_conn |> mutation_get_error?(@delete_tag_query, variables, ecode(:passport))
    end
  end
end
