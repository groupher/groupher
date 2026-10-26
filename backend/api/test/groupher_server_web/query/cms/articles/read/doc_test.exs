defmodule GroupherServer.Test.Query.Articles.Doc do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat

  setup do
    {community, doc, doc_attrs, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn doc user community doc_attrs)a}
  end

  test "basic graphql query on doc with login user",
       ~m(user_conn community user doc_attrs)a do
    {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

    variables = %{
      article: %{
        inner_id: article_inner_id(doc, community),
        community: community.slug,
        thread: "DOC"
      }
    }

    results = user_conn |> gq_query(S.Article.q(:article, :doc), variables)

    assert results["innerId"] == to_string(article_inner_id(doc, community))
    assert get_in(results, ["community", "slug"]) == community.slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{"isEdited" => false}
  end

  test "basic graphql query on doc with stranger(un-login user)",
       ~m(guest_conn community doc_attrs user)a do
    {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

    variables = %{
      article: %{
        inner_id: article_inner_id(doc, community),
        community: community.slug,
        thread: "DOC"
      }
    }

    results = guest_conn |> gq_query(S.Article.q(:article, :doc), variables)

    assert results["innerId"] == to_string(article_inner_id(doc, community))
    assert is_valid_kv?(results, "title", :string)
  end

  test "returns cancan error when doc thread is disabled",
       ~m(guest_conn community doc_attrs user)a do
    {:ok, doc} = CMS.Articles.create(community, :doc, doc_attrs, user)

    {:ok, _} =
      CMS.Dashboard.update(
        community,
        :enable,
        %{
          doc: false
        },
        user,
        Ecto.UUID.generate()
      )

    variables = %{
      article: %{
        inner_id: article_inner_id(doc, community),
        community: community.slug,
        thread: "DOC"
      }
    }

    assert guest_conn
           |> query_error?(
             S.Article.q(:article, :doc),
             variables,
             ErrorCat.code(ErrorCat.thread_not_visible())
           )
  end
end
