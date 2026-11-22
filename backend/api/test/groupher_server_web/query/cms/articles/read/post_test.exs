defmodule GroupherServer.Test.Query.Articles.Post do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS
  alias GroupherServer.ErrorCat, as: DomainErrorCat
  alias CMS.Articles.ErrorCat

  setup do
    {community, post, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn post user community post_attrs)a}
  end

  test "basic graphql query on post with login user",
       ~m(user_conn community user post_attrs)a do
    {:ok, post} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs, user)

    variables = %{
      article: %{
        inner_id: article_inner_id(post, community),
        community: community.slug,
        thread: "POST"
      }
    }

    results = user_conn |> gq_query(S.Article.q(:article, :post, "author { login }"), variables)

    assert results["innerId"] == to_string(article_inner_id(post, community))
    assert get_in(results, ["community", "slug"]) == community.slug
    assert get_in(results, ["author", "login"]) == user.login

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{"isEdited" => false}
  end

  test "Article detail exposes communities and public publication timestamps",
       ~m(user_conn community user post_attrs)a do
    {:ok, post} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs, user)

    variables = %{
      article: %{
        inner_id: article_inner_id(post, community),
        community: community.slug,
        thread: "POST"
      }
    }

    result =
      user_conn
      |> gq_query(
        S.Article.q(
          :article,
          :post,
          "communities { slug } insertedAt updatedAt articleTags { id }"
        ),
        variables
      )

    assert result["communities"] == [%{"slug" => community.slug}]
    assert is_binary(result["insertedAt"])
    assert result["insertedAt"] == result["updatedAt"]
    assert result["articleTags"] == []
  end

  test "basic graphql query on post with stranger(un-login user)",
       ~m(guest_conn community post_attrs user)a do
    {:ok, post} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs, user)

    variables = %{
      article: %{
        inner_id: article_inner_id(post, community),
        community: community.slug,
        thread: "POST"
      }
    }

    results = guest_conn |> gq_query(S.Article.q(:article, :post), variables)

    assert results["innerId"] == to_string(article_inner_id(post, community))
    assert is_valid_kv?(results, "title", :string)
  end

  test "anonymous readers receive only the safe Article ArticleLog",
       ~m(guest_conn community post)a do
    variables = %{
      article: %{
        inner_id: article_inner_id(post, community),
        community: community.slug,
        thread: "POST"
      },
      filter: %{page: 1}
    }

    result = guest_conn |> gq_query(S.Article.q(:article_logs), variables)

    assert result["totalCount"] >= 1
    created = Enum.find(result["entries"], &(&1["action"] == "created"))
    assert created["id"]
    assert created["subject"]["type"] == "post"
    assert created["subject"]["ref"] == post.id
    assert created["payload"] == %{}
    refute Map.has_key?(created, "metadata")
    refute Map.has_key?(created, "source")
  end

  test "returns cancan error when post thread is disabled",
       ~m(guest_conn community post_attrs user)a do
    {:ok, post} =
      GroupherServer.Support.Factory.create_published_article(community, :post, post_attrs, user)

    {:ok, _} =
      CMS.Dashboard.update(
        community,
        :enable,
        %{
          post: false
        },
        user,
        Ecto.UUID.generate()
      )

    variables = %{
      article: %{
        inner_id: article_inner_id(post, community),
        community: community.slug,
        thread: "POST"
      }
    }

    assert guest_conn
           |> query_error?(
             S.Article.q(:article, :post),
             variables,
             ErrorCat.code(ErrorCat.thread_not_visible())
           )

    assert {:error, %DomainErrorCat.Error{reason: :thread_not_visible}} =
             CMS.FrontDesk.article(post.id, nil, mode: :public, community: community)

    assert {:error, %DomainErrorCat.Error{reason: :thread_not_visible}} =
             CMS.FrontDesk.article(post.id, user, mode: :admin, community: community)
  end
end
