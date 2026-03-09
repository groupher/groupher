defmodule GroupherServer.Test.Mutation.Articles.DocumentFlow do
  @moduledoc false

  use GroupherServer.TestTools

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
    {:doc, "createDoc", "updateDoc", "doc"},
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

        created = user_conn |> gq_mutation(create_mutation(unquote(create_op)), create_vars)

        assert created["document"]["json"] == @plate_body
        assert is_binary(created["document"]["html"])
        assert is_binary(created["document"]["markdown"])
        assert is_binary(created["document"]["rss"])
        assert is_map(created["document"]["markdownToc"])

        update_vars = %{
          article: %{inner_id: created["innerId"], community: community.slug},
          title: "#{unquote(thread)}-updated-#{unique}",
          body: @plate_body_updated
        }

        updated = user_conn |> gq_mutation(update_mutation(unquote(update_op)), update_vars)

        assert updated["document"]["json"] == @plate_body_updated
        assert updated["title"] == update_vars.title

        query_vars = %{article: %{inner_id: created["innerId"], community: community.slug}}
        queried = user_conn |> gq_query(article_query(unquote(query_field)), query_vars)

        assert queried["document"]["json"] == @plate_body_updated
        assert is_binary(queried["document"]["html"])
      end
    end
  end

  defp create_mutation(operation) do
    """
    mutation($title: String!, $body: String!, $community: String!) {
      #{operation}(title: $title, body: $body, community: $community) {
        innerId
        title
        document {
          json
          markdown
          markdownToc
          html
          rss
        }
      }
    }
    """
  end

  defp update_mutation(operation) do
    """
    mutation($article: ArticleRefInput!, $title: String, $body: String) {
      #{operation}(article: $article, title: $title, body: $body) {
        innerId
        title
        document {
          json
          markdown
          markdownToc
          html
          rss
        }
      }
    }
    """
  end

  defp article_query(field_name) do
    """
    query($article: ArticleRefInput!) {
      #{field_name}(article: $article) {
        innerId
        title
        document {
          json
          markdown
          markdownToc
          html
          rss
        }
      }
    }
    """
  end
end
