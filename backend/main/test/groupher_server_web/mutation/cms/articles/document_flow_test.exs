defmodule GroupherServer.Test.Mutation.Articles.DocumentFlow do
  @moduledoc false

  use GroupherServer.TestMate

  @plate_body Jason.encode!([
                %{"type" => "h1", "children" => [%{"text" => "Plate Title"}]},
                %{"type" => "p", "children" => [%{"text" => "hello @world"}]}
              ])

  @plate_body_updated Jason.encode!([
                        %{"type" => "h1", "children" => [%{"text" => "Updated Title"}]},
                        %{
                          "type" => "p",
                          "children" => [
                            %{"text" => "mention "},
                            %{
                              "type" => "mention",
                              "value" => "李四",
                              "children" => [%{"text" => ""}]
                            }
                          ]
                        }
                      ])

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user user_conn community)a}
  end

  @threads [
    {:post, "createPost", "updatePost", "post"},
    {:changelog, "createChangelog", "updateChangelog", "changelog"},
    {:blog, "createBlog", "updateBlog", "blog"}
  ]

  describe "[document flow e2e]" do
    for {thread, create_op, update_op, query_field} <- @threads do
      test "#{thread} mutation and query return document payload", ~m(user_conn community)a do
        unique = System.unique_integer([:positive, :monotonic])

        create_vars = %{
          title: "#{unquote(thread)}-#{unique}",
          body: @plate_body,
          community: community.slug
        }

        created =
          user_conn |> gq_mutation(S.Article.m(:create_document, unquote(create_op)), create_vars)

        assert created["document"]["json"] == @plate_body
        assert is_binary(created["document"]["html"])
        assert is_binary(created["document"]["markdown"])
        assert created["document"]["xml"] == nil
        assert created["document"]["rss"] == nil
        assert is_map(created["document"]["markdownToc"])

        update_vars = %{
          article: %{
            inner_id: created["innerId"],
            community: community.slug,
            thread: unquote(thread |> to_string() |> String.upcase())
          },
          title: "#{unquote(thread)}-updated-#{unique}",
          body: @plate_body_updated
        }

        updated =
          user_conn |> gq_mutation(S.Article.m(:update_document, unquote(update_op)), update_vars)

        assert updated["document"]["json"] == @plate_body_updated
        assert updated["title"] == update_vars.title

        query_vars = %{
          article: %{
            inner_id: created["innerId"],
            community: community.slug,
            thread: unquote(thread |> to_string() |> String.upcase())
          }
        }

        queried =
          user_conn |> gq_query(S.Article.q(:document, unquote(query_field), nil), query_vars)

        assert queried["document"]["json"] == @plate_body_updated
        assert is_binary(queried["document"]["html"])
      end
    end
  end
end
