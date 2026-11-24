defmodule GroupherServer.Test.CMS.Passport.Authorization do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS
  alias CMS.Model.GlobalPassport
  alias CMS.Passport.Authorization

  test "passport check accepts a stored global reviewer grant and rejects the normalized legacy projection" do
    {:ok, user} = db_insert(:user)

    reviewer =
      Map.put(user, :cur_passport, %{"global" => %{"community.application.review" => true}})

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             Authorization.check(reviewer, "community.application.review", %{})

    row =
      Repo.insert!(
        GlobalPassport.changeset(%GlobalPassport{}, %{
          user_id: user.id,
          permissions: %{"community.application.review" => true}
        })
      )

    assert {:ok, true} =
             Authorization.check(reviewer, "community.application.review", %{})

    Repo.update!(GlobalPassport.changeset(row, %{permissions: %{}}))

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             Authorization.check(reviewer, "community.application.review", %{})
  end

  test "passport check returns a stable denial" do
    reviewer = %{cur_passport: %{"global" => %{}}}

    assert {:error, %ErrorCat.Error{reason: :permission_denied}} =
             Authorization.check(reviewer, "community.application.review", %{})
  end

  test "passport check rejects unknown actions even when legacy actor rules contain them" do
    reviewer = %{cur_passport: %{"global" => %{"unknown.action" => true}}}

    assert {:error, %ErrorCat.Error{reason: :unknown_passport_action}} =
             Authorization.check(reviewer, "unknown.action", %{})
  end

  test "authorize returns a review denial for an unprivileged passport" do
    reviewer = %{cur_passport: %{"global" => %{}}}

    assert {:error, %ErrorCat.Error{reason: :review_permission_denied}} =
             Authorization.authorize(reviewer, "community.application.review")
  end
end
