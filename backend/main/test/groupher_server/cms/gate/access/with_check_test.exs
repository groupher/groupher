defmodule GroupherServer.Test.CMS.Gate.Access.WithCheck do
  use GroupherServer.TestMate

  alias GroupherServer.CMS.Gate.Access
  alias GroupherServer.CMS.Model.Comment
  alias GroupherServer.Repo
  alias Helper.ORM

  setup do
    {community, post, _, actor} = mock_article(:post, preload: [author: :user])

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), actor)

    {:ok, ~m(comment actor)a}
  end

  describe "with_check/4 transaction contract" do
    test "commits a valid callback result", ~m(comment actor)a do
      assert {:ok, updated} =
               Access.with_check(actor, :edit, comment, fn canonical ->
                 assert Repo.in_transaction?()
                 ORM.update(canonical, %{body_html: "committed"})
               end)

      assert updated.body_html == "committed"
      assert Repo.get!(Comment, comment.id).body_html == "committed"
    end

    test "rolls back callback errors", ~m(comment actor)a do
      before = comment.body_html

      assert {:error, :stop} =
               Access.with_check(actor, :edit, comment, fn canonical ->
                 {:ok, _} = ORM.update(canonical, %{body_html: "must rollback"})
                 {:error, :stop}
               end)

      assert Repo.get!(Comment, comment.id).body_html == before
    end

    test "normalizes an invalid callback shape inside the transaction", ~m(comment actor)a do
      before = comment.body_html

      assert {:error, %{reason: :unexpected_callback_result, details: details}} =
               Access.with_check(actor, :edit, comment, fn canonical ->
                 {:ok, _} = ORM.update(canonical, %{body_html: "must rollback"})
                 {:unexpected, :raw, "secret must not leak"}
               end)

      assert details == %{result_kind: :tuple, tuple_arity: 3}
      refute inspect(details) =~ "secret"
      assert Repo.get!(Comment, comment.id).body_html == before
    end

    test "rolls back and propagates callback exceptions", ~m(comment actor)a do
      before = comment.body_html

      assert_raise RuntimeError, "boom", fn ->
        Access.with_check(actor, :edit, comment, fn canonical ->
          {:ok, _} = ORM.update(canonical, %{body_html: "must rollback"})
          raise "boom"
        end)
      end

      assert Repo.get!(Comment, comment.id).body_html == before
    end

    test "rolls back and preserves callback throws", ~m(comment actor)a do
      before = comment.body_html

      assert catch_throw(
               Access.with_check(actor, :edit, comment, fn canonical ->
                 {:ok, _} = ORM.update(canonical, %{body_html: "must rollback"})
                 throw(:boom)
               end)
             ) == :boom

      assert Repo.get!(Comment, comment.id).body_html == before
    end
  end
end
