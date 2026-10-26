defmodule GroupherServer.Test.Query.Articles.Changelog do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS
  alias CMS.Articles.ErrorCat

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
        inner_id: article_inner_id(changelog, community),
        community: community.slug,
        thread: "CHANGELOG"
      }
    }

    results = user_conn |> gq_query(S.Article.q(:article, :changelog), variables)

    assert results["innerId"] == to_string(article_inner_id(changelog, community))
    assert get_in(results, ["community", "slug"]) == community.slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{"isEdited" => false}
  end

  test "basic graphql query on changelog with stranger(un-login user)",
       ~m(guest_conn community changelog_attrs user)a do
    {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

    variables = %{
      article: %{
        inner_id: article_inner_id(changelog, community),
        community: community.slug,
        thread: "CHANGELOG"
      }
    }

    results = guest_conn |> gq_query(S.Article.q(:article, :changelog), variables)

    assert results["innerId"] == to_string(article_inner_id(changelog, community))
    assert is_valid_kv?(results, "title", :string)
  end

  test "returns cancan error when changelog thread is disabled",
       ~m(guest_conn community changelog_attrs user)a do
    {:ok, changelog} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

    {:ok, _} =
      CMS.Dashboard.update(
        community,
        :enable,
        %{
          changelog: false
        },
        user,
        Ecto.UUID.generate()
      )

    variables = %{
      article: %{
        inner_id: article_inner_id(changelog, community),
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
