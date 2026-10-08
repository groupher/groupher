defmodule GroupherServer.Test.Mutation.Sink.BlogSink do
  @moduledoc false
  use GroupherServer.TestMate
  alias GroupherServer.Accounts
  alias Accounts.Profiles.ErrorCat

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn community blog user)a}
  end

  describe "[blog sink]" do
    test "login user can sink a blog", ~m(community blog)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        }
      }

      passport_rules = %{community.slug => %{"blog.sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      result = rule_conn |> gq_mutation(S.Article.m(:sink_article, :blog), variables)
      assert result["innerId"] == to_string(article_inner_id(blog, community))

      blog = Repo.get!(CMS.Model.Article, blog.id)
      assert blog.is_sunk
      assert blog.active_at == blog.inserted_at
    end

    test "unauth user sink a blog fails", ~m(guest_conn community blog)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        }
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:sink_article, :blog),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end

    test "login user can undo sink to a blog", ~m(community blog user)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        }
      }

      passport_rules = %{community.slug => %{"blog.undo_sink" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, _} = CMS.Articles.sink(blog.id, user, community: community)

      updated = rule_conn |> gq_mutation(S.Article.m(:undo_sink_article, :blog), variables)

      assert updated["innerId"] == to_string(article_inner_id(blog, community))

      refute Repo.get!(CMS.Model.Article, blog.id).is_sunk
    end

    test "unauth user undo sink a blog fails", ~m(guest_conn community blog)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        }
      }

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:undo_sink_article, :blog),
               variables,
               ErrorCat.code(ErrorCat.account_login())
             )
    end
  end
end
