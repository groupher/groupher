defmodule GroupherServer.Test.CMS.Passport.GlobalFactsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Passport
  alias GroupherServer.CMS.Model.GlobalPassport

  test "returns normalized facts and fails closed for invalid stored grants" do
    {:ok, user} = db_insert(:user)
    assert {:ok, %{is_root: false, permissions: %{}}} = Passport.global_facts(user.id)

    row =
      Repo.insert!(
        GlobalPassport.changeset(%GlobalPassport{}, %{
          user_id: user.id,
          is_root: true,
          permissions: %{"community.create" => true, "community.request_destroy" => false}
        })
      )

    assert {:ok, %{is_root: true, permissions: %{"community.create" => true}}} =
             Passport.global_facts(user.id)

    row |> GlobalPassport.changeset(%{permissions: %{"article.update" => true}}) |> Repo.update!()
    assert {:error, :permission_scope_mismatch} = Passport.global_facts(user.id)
    assert {:error, :permission_scope_mismatch} = Passport.system_root?(user.id)

    row
    |> GlobalPassport.changeset(%{permissions: %{"unregistered.action" => true}})
    |> Repo.update!()

    assert {:error, :unknown_action} = Passport.global_facts(user.id)

    row
    |> GlobalPassport.changeset(%{permissions: %{"community.create" => "yes"}})
    |> Repo.update!()

    assert {:error, :invalid_permission_value} = Passport.global_facts(user.id)
  end
end
