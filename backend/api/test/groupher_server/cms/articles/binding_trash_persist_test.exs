defmodule GroupherServer.Test.CMS.Articles.BindingTrashPersistTest do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.{CMS, Repo}
  alias CMS.Articles.BindingTrashPersist, as: Persist
  alias CMS.Model.{Article, ArticleBindingTrash}

  test "hide is idempotent; stale tokens cannot restore a newer hide" do
    {community, public, _, actor} = mock_article(:post)
    article = Repo.get!(Article, public.id)

    assert {:ok, %{row: first, changed?: true}} =
             Repo.transaction(fn ->
               {:ok, result} = Persist.hide(article, community, actor)
               result
             end)

    assert first.revision == 1

    assert {:ok, %{row: same, changed?: false}} =
             Repo.transaction(fn ->
               {:ok, result} = Persist.hide(article, community, actor)
               result
             end)

    assert same.id == first.id

    assert {:ok, {:error, %{reason: :invalid_binding_trash_revision}}} =
             Repo.transaction(fn ->
               Persist.restore(article, community, first.id, "2")
             end)

    assert Repo.get!(ArticleBindingTrash, first.id)

    assert {:ok, {:ok, _}} =
             Repo.transaction(fn -> Persist.restore(article, community, first.id, "1") end)

    assert {:ok, %{row: second, changed?: true}} =
             Repo.transaction(fn ->
               {:ok, result} = Persist.hide(article, community, actor)
               result
             end)

    refute second.id == first.id

    assert {:ok, {:error, %{reason: :binding_trash_revision_conflict}}} =
             Repo.transaction(fn ->
               Persist.restore(article, community, first.id, "1")
             end)

    assert Repo.get!(ArticleBindingTrash, second.id)
  end

  test "hide admission uses the current Community permission and not Article ownership" do
    {community, public, _, owner} = mock_article(:post)
    {:ok, actor} = db_insert(:user)
    {:ok, other} = mock_community(owner)

    passport =
      Repo.get_by(CMS.Model.GlobalPassport, user_id: owner.id) || %CMS.Model.GlobalPassport{}

    passport
    |> CMS.Model.GlobalPassport.changeset(%{
      user_id: owner.id,
      is_root: false
    })
    |> Repo.insert_or_update!()

    owner_admin =
      Repo.get_by!(CMS.Model.CommunityAdmin,
        community_id: community.id,
        user_id: owner.id
      )

    Repo.update!(Ecto.Changeset.change(owner_admin, is_lord: false, permissions: %{}))

    article = Repo.get!(Article, public.id)

    admission = fn user ->
      {:ok, result} =
        Repo.transaction(fn ->
          {:ok, context} =
            CMS.Gate.Access.Load.Query.article_in_community(user, community, :post, article)

          CMS.Gate.Access.Policy.Article.check_access(user, :community_hide, context)
        end)

      result
    end

    assert {:error, %{reason: :permission_denied}} = admission.(owner)
    assert {:error, %{reason: :permission_denied}} = admission.(actor)

    {:ok, _} =
      %CMS.Model.CommunityAdmin{}
      |> CMS.Model.CommunityAdmin.changeset(%{
        user_id: actor.id,
        community_id: other.id,
        joined_at: DateTime.utc_now(:second),
        permissions: %{"community.article.trash.read" => true, "community.article.hide" => true}
      })
      |> Repo.insert()

    assert {:error, %{reason: :permission_denied}} = admission.(actor)

    {:ok, _} =
      %CMS.Model.CommunityAdmin{}
      |> CMS.Model.CommunityAdmin.changeset(%{
        user_id: actor.id,
        community_id: community.id,
        joined_at: DateTime.utc_now(:second),
        permissions: %{"community.article.trash.read" => true, "community.article.hide" => true}
      })
      |> Repo.insert()

    assert {:ok, :pass} = admission.(actor)
  end
end
