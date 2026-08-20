defmodule GroupherServer.Test.Query.Articles.Changelog do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS.Articles.ErrorCat

  setup do
    {community, changelog, changelog_attrs, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn changelog user community changelog_attrs)a}
  end

  test "basic graphql query on changelog with login user",
       ~m(user_conn community user changelog_attrs)a do
    {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

    variables = %{
      article: %{
        inner_id: changelog.inner_id,
        community: community.slug,
        thread: "CHANGELOG"
      }
    }

    results = user_conn |> gq_query(S.Article.q(:article, :changelog), variables)

    assert results["innerId"] == to_string(changelog.inner_id)
    assert get_in(results, ["community", "slug"]) == community.slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }
  end

  test "basic graphql query on changelog with stranger(un-login user)",
       ~m(guest_conn community changelog_attrs user)a do
    {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

    variables = %{
      article: %{
        inner_id: changelog.inner_id,
        community: community.slug,
        thread: "CHANGELOG"
      }
    }

    results = guest_conn |> gq_query(S.Article.q(:article, :changelog), variables)

    assert results["innerId"] == to_string(changelog.inner_id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user changelog_attrs)a do
    {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

    variables = %{
      article: %{
        inner_id: changelog.inner_id,
        community: community.slug,
        thread: "CHANGELOG"
      }
    }

    results = user_conn |> gq_query(S.Article.q(:article, :changelog), variables)

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> gq_query(S.Article.q(:article, :changelog), variables)
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.Articles.set_illegal(:changelog, changelog.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> gq_query(S.Article.q(:article, :changelog), variables)

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end

  test "returns cancan error when changelog thread is disabled",
       ~m(guest_conn community changelog_attrs user)a do
    {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

    {:ok, _} =
      CMS.Dashboard.update(community, :enable, %{
        changelog: false
      })

    variables = %{
      article: %{
        inner_id: changelog.inner_id,
        community: community.slug,
        thread: "CHANGELOG"
      }
    }

    assert guest_conn
           |> query_error?(
             S.Article.q(:article, :changelog),
             variables,
             ErrorCat.code(ErrorCat.thread_not_visible())
           )
  end
end
