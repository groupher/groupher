defmodule GroupherServer.Test.CMS.Events.Audition.CommentTest do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, post} = db_insert(:post)

    {:ok, ~m(user post)a}
  end

  describe "[audit comment basic]" do
  end
end
