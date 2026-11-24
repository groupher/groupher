defmodule GroupherServer.Test.CMS.Passport.TrashReadReviewTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false
  alias GroupherServer.CMS

  test "Trash reads use Article ownership, never ordinary Community permission" do
    {community, post, _, owner} = mock_article(:post)
    {:ok, outsider} = db_insert(:user)

    Repo.insert!(
      CMS.Model.CommunityAdmin.changeset(%CMS.Model.CommunityAdmin{}, %{
        community_id: community.id,
        user_id: outsider.id,
        permissions: %{"community.article.trash.read" => true}
      })
    )

    assert {:ok, item} = CMS.Articles.trash(post, owner)

    assert {:ok, %{entries: [owned]}} =
             CMS.Articles.list_trashed(community, %{thread: :post}, nil, owner)

    assert owned.hash_id == item.hash_id

    assert {:ok, %{entries: []}} =
             CMS.Articles.list_trashed(community, %{thread: :post}, nil, outsider)

    assert {:error, _} = CMS.Articles.get_trashed(item.hash_id, community, :post, outsider)

    Repo.insert!(
      CMS.Model.GlobalPassport.changeset(%CMS.Model.GlobalPassport{}, %{
        user_id: outsider.id,
        is_root: true
      })
    )

    assert {:ok, %{entries: [_]}} =
             CMS.Articles.list_trashed(community, %{thread: :post}, nil, outsider)
  end

  test "GraphQL Trash collection reaches identity-scoped admission without generic Passport middleware" do
    {community, post, _, owner} = mock_article(:post)
    assert {:ok, item} = CMS.Articles.trash(post, owner)

    query =
      "query($community: String!) { trashedArticles(community: $community, thread: POST) { entries { id } } }"

    assert {:ok, %{data: %{"trashedArticles" => %{"entries" => [%{"id" => id}]}}}} =
             Absinthe.run(query, GroupherServerWeb.Schema,
               variables: %{"community" => community.slug},
               context: %{cur_user: owner}
             )

    assert id == item.hash_id
  end
end
