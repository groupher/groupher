defmodule GroupherServer.Test.CMS.Gate do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  require CMS.Const

  test "root facade exposes only scope and access_check" do
    Code.ensure_loaded!(CMS.Gate)

    assert function_exported?(CMS.Gate, :scope, 4)
    assert function_exported?(CMS.Gate, :access_check, 3)
    refute function_exported?(CMS.Gate, :scope, 3)
    refute function_exported?(CMS.Gate, :access_check, 4)
    refute function_exported?(CMS.Gate, :can, 3)
    refute function_exported?(CMS.Gate, :check, 3)
    refute function_exported?(CMS.Gate, :decide, 4)
  end

  test "draft reads are exposed through Scope rather than Access" do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_policy_actor_mismatch}} =
             CMS.Gate.scope(
               CMS.Model.Post,
               nil,
               :read_draft,
               CMS.Gate.Context.Scope.Article.draft(:post, :owner_management)
             )
  end
end
