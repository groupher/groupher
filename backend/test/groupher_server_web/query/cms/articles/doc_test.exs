defmodule GroupherServer.Test.Query.Articles.Doc do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, doc} = db_insert(:doc)
    {:ok, community} = db_insert(:community)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    {:ok, ~m(user_conn guest_conn doc user community doc_attrs)a}
  end

  @query """
  query($community: String!, $id: ID!) {
    doc(community: $community, id: $id) {
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

  test "basic graphql query on doc with logined user",
       ~m(user_conn community user doc_attrs)a do
    {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

    variables = %{community: doc.original_community_slug, id: doc.inner_id}
    results = user_conn |> query_result(@query, variables, "doc")

    assert results["id"] == to_string(doc.id)
    assert results["originalCommunitySlug"] == doc.original_community_slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }

    assert length(Map.keys(results)) == 7
  end

  test "basic graphql query on doc with stranger(unloged user)",
       ~m(guest_conn community doc_attrs user)a do
    {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)

    variables = %{community: doc.original_community_slug, id: doc.inner_id}
    results = guest_conn |> query_result(@query, variables, "doc")

    assert results["id"] == to_string(doc.id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user doc_attrs)a do
    {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
    variables = %{community: doc.original_community_slug, id: doc.inner_id}
    results = user_conn |> query_result(@query, variables, "doc")

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> query_result(@query, variables, "doc")
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.set_article_illegal(:doc, doc.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> query_result(@query, variables, "doc")

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end
end
