defmodule GroupherServer.Test.Query.Articles.Changelog do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, changelog} = db_insert(:changelog)
    {:ok, community} = db_insert(:community)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    changelog_attrs = mock_attrs(:changelog, %{community_id: community.id})

    {:ok, ~m(user_conn guest_conn changelog user community changelog_attrs)a}
  end

  @query """
  query($community: String!, $id: ID!) {
    changelog(community: $community, id: $id) {
      id
      title
      innerId
      originalCommunitySlug
      meta {
        isEdited
        isLegal
        illegalReason
        illegalWords
      }
      isArchived
      archivedAt
    }
  }
  """

  test "basic graphql query on changelog with logined user",
       ~m(user_conn community user changelog_attrs)a do
    {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

    variables = %{community: changelog.original_community_slug, id: changelog.inner_id}
    results = user_conn |> query_result(@query, variables, "changelog")

    assert results["id"] == to_string(changelog.id)
    assert results["originalCommunitySlug"] == changelog.original_community_slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }

    assert length(Map.keys(results)) == 7
  end

  test "basic graphql query on changelog with stranger(unloged user)",
       ~m(guest_conn community changelog_attrs user)a do
    {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)

    variables = %{community: changelog.original_community_slug, id: changelog.inner_id}
    results = guest_conn |> query_result(@query, variables, "changelog")

    assert results["id"] == to_string(changelog.id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user changelog_attrs)a do
    {:ok, changelog} = CMS.create_article(community, :changelog, changelog_attrs, user)
    variables = %{community: changelog.original_community_slug, id: changelog.inner_id}
    results = user_conn |> query_result(@query, variables, "changelog")

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> query_result(@query, variables, "changelog")
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.set_article_illegal(:changelog, changelog.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> query_result(@query, variables, "changelog")

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end
end
