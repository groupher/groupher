defmodule GroupherServer.Test.CMS.Passport.Authorization do
  @moduledoc false

  use GroupherServer.TestMate

  alias CMS.Passport.Authorization

  test "passport check accepts a normalized global reviewer passport" do
    reviewer = %{cur_passport: %{"global" => %{"community.application.review" => true}}}

    assert {:ok, true} =
             Authorization.check(reviewer, "community.application.review", %{})
  end

  test "passport check returns a stable denial" do
    reviewer = %{cur_passport: %{"global" => %{}}}

    assert {:error, :permission_denied} =
             Authorization.check(reviewer, "community.application.review", %{})
  end

  test "authorize returns a review denial for an unprivileged passport" do
    reviewer = %{cur_passport: %{"global" => %{}}}

    assert {:error, :review_permission_denied} =
             Authorization.authorize(reviewer, "community.application.review")
  end
end
