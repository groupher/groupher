defmodule GroupherServer.Test.Query.Hooks.DocCiting do
  @moduledoc false

  use GroupherServer.TestTools
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS

  alias CMS.Delegate.Hooks

  @site_host get_config(:general, :site_host)

  setup do
    {:ok, doc} = db_insert(:doc)
    {:ok, user} = db_insert(:user)

    {:ok, community} = db_insert(:community)
    doc_attrs = mock_attrs(:doc, %{community_id: community.id})

    guest_conn = simu_conn(:guest)

    {:ok, ~m(guest_conn community doc doc_attrs user)a}
  end

  describe "[query paged_docs filter pagination]" do
    # id
    @query """
    query($content: Content!, $id: ID!, $filter: PagiFilter!) {
      pagedCitingContents(id: $id, content: $content, filter: $filter) {
        entries {
          id
          title
          user {
            login
            nickname
            avatar
          }
          commentId
        }
        totalPages
        totalCount
        pageSize
        pageNumber
      }
    }
    """

    test "should get paged cittings", ~m(guest_conn community doc_attrs user)a do
      {:ok, doc2} = db_insert(:doc)

      {:ok, comment} =
        CMS.create_comment(
          :doc,
          doc2.id,
          mock_comment(~s(the <a href=#{@site_host}/doc/#{doc2.id} />)),
          user
        )

      body =
        mock_rich_text(
          ~s(the <a href=#{@site_host}/doc/#{doc2.id} />),
          ~s(the <a href=#{@site_host}/doc/#{doc2.id} />)
        )

      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc_x} = CMS.create_article(community, :doc, doc_attrs, user)

      body = mock_rich_text(~s(the <a href=#{@site_host}/doc/#{doc2.id} />))
      doc_attrs = doc_attrs |> Map.merge(%{body: body})
      {:ok, doc_y} = CMS.create_article(community, :doc, doc_attrs, user)

      Hooks.Cite.handle(doc_x)
      Hooks.Cite.handle(comment)
      Hooks.Cite.handle(doc_y)

      variables = %{content: "DOC", id: doc2.id, filter: %{page: 1, size: 10}}
      results = guest_conn |> query_result(@query, variables, "pagedCitingContents")

      assert results |> is_valid_pagination?
      assert results["totalCount"] == 3
    end
  end
end
