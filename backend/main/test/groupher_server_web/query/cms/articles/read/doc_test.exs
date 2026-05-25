defmodule GroupherServer.Test.Query.Articles.Doc do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, doc, doc_attrs, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn doc user community doc_attrs)a}
  end

  test "basic graphql query on doc with login user",
       ~m(user_conn community user doc_attrs)a do
    {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

    variables = %{article: %{inner_id: doc.inner_id, community: doc.community_slug}}
    results = user_conn |> gq_query(Schema.q(:article, :doc), variables)

    assert results["innerId"] == to_string(doc.inner_id)
    assert results["communitySlug"] == doc.community_slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }
  end

  test "basic graphql query on doc with stranger(un-login user)",
       ~m(guest_conn community doc_attrs user)a do
    {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

    variables = %{article: %{inner_id: doc.inner_id, community: doc.community_slug}}
    results = guest_conn |> gq_query(Schema.q(:article, :doc), variables)

    assert results["innerId"] == to_string(doc.inner_id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user doc_attrs)a do
    {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)
    variables = %{article: %{inner_id: doc.inner_id, community: doc.community_slug}}
    results = user_conn |> gq_query(Schema.q(:article, :doc), variables)

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> gq_query(Schema.q(:article, :doc), variables)
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.Articles.set_illegal(:doc, doc.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> gq_query(Schema.q(:article, :doc), variables)

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end

  test "returns cancan error when doc thread is disabled",
       ~m(guest_conn community doc_attrs user)a do
    {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

    {:ok, _} =
      CMS.Dashboard.update(community, :enable, %{
        doc: false
      })

    variables = %{article: %{inner_id: doc.inner_id, community: doc.community_slug}}

    assert guest_conn
           |> query_error?(Schema.q(:article, :doc), variables, ecode(:thread_not_visible))
  end
end
