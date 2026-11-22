defmodule GroupherServer.Test.CMS.Articles.MutationLockPlanTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.{Articles.MutationLock, Model.ArticleBinding}

  test "a changed Binding set requires the transaction to retry" do
    {x, public, _, actor} = mock_article(:post)
    {:ok, y} = mock_community(actor)

    assert {:ok, :checked} =
             Repo.transaction(fn ->
               assert {:ok, plan} = MutationLock.lock_community_plan([public.id], [x.id])
               assert {:ok, :pass} = MutationLock.verify_community_plan(plan)

               Repo.insert!(
                 ArticleBinding.changeset(%ArticleBinding{}, %{
                   article_id: public.id,
                   community_id: y.id
                 })
               )

               assert {:error, %{reason: :community_admission_changed}} =
                        MutationLock.verify_community_plan(plan)

               :checked
             end)
  end
end
