defmodule GroupherServer.Test.Query.Accounts.Published.Docs do
  @moduledoc false

  use GroupherServer.TestTools

  @publish_count 10

  setup do
    {community, doc, _, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(guest_conn user_conn community doc user)a}
  end

  describe "[published docs]" do
    @query """
    query($login: String!, $filter: PagiFilter!) {
      pagedPublishedDocs(login: $login, filter: $filter) {
        entries {
          id
          title
          author {
            id
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "can get published docs", ~m(guest_conn community user)a do
      doc_attrs = mock_attrs(:doc, %{community_id: community.id})

      {:ok, doc} = CMS.create_article(community, :doc, doc_attrs, user)
      {:ok, doc2} = CMS.create_article(community, :doc, doc_attrs, user)

      variables = %{login: user.login, filter: %{page: 1, size: 20}}
      results = guest_conn |> query_result(@query, variables, "pagedPublishedDocs")

      assert results["entries"] |> Enum.any?(&(&1["id"] == to_string(doc.id)))
      assert results["entries"] |> Enum.any?(&(&1["id"] == to_string(doc2.id)))
    end
  end

  describe "[account published comments on doc]" do
    @query """
    query($login: String!, $thread: Thread, $filter: PagiFilter!) {
      pagedPublishedComments(login: $login, thread: $thread, filter: $filter) {
        entries {
          id
          bodyHtml
          author {
            id
          }
          article {
            id
            title
            thread
            author {
              nickname
              login
            }
          }
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """
    test "user can get paged published comments on doc", ~m(guest_conn user community doc)a do
      pub_comments =
        Enum.reduce(1..@publish_count, [], fn _, acc ->
          {:ok, comment} =
            CMS.create_comment(community, :doc, doc.inner_id, mock_comment(), user)

          acc ++ [comment]
        end)

      random_comment_id = pub_comments |> Enum.random() |> Map.get(:id) |> to_string

      variables = %{login: user.login, thread: "DOC", filter: %{page: 1, size: 20}}

      results = guest_conn |> query_result(@query, variables, "pagedPublishedComments")

      entries = results["entries"]
      assert results |> is_valid_pagination?
      assert results["totalCount"] == @publish_count

      assert entries |> Enum.all?(&(not is_nil(&1["article"]["author"])))

      assert entries |> Enum.all?(&(&1["article"]["id"] == to_string(doc.id)))
      assert entries |> Enum.all?(&(&1["author"]["id"] == to_string(user.id)))
      assert entries |> Enum.any?(&(&1["id"] == random_comment_id))
    end
  end
end
