defmodule GroupherServer.Test.CMS.CacheEffectIdentityTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Outbox.Event

  test "taxonomy callers cannot provide additional dedupe dimensions" do
    Code.ensure_loaded!(CMS.Communities.Tags.Effects)
    refute function_exported?(CMS.Communities.Tags.Effects, :enqueue_taxonomy_changed, 4)
    assert function_exported?(CMS.Communities.Tags.Effects, :enqueue_taxonomy_changed, 3)
  end

  test "independent config and reaction operations survive a return to earlier state" do
    {:ok, community} = db_insert(:community)
    first = Ecto.UUID.generate()
    second = Ecto.UUID.generate()

    constructors = [
      fn ref -> CMS.Dashboard.Effects.enqueue_presentation_changed(community, ref) end,
      fn ref -> CMS.Dashboard.Effects.enqueue_pagi_mode_changed(community, ref) end,
      fn ref -> CMS.DocTree.Effects.enqueue_invalidation(community, ref) end,
      fn ref -> CMS.Press.Effects.enqueue_invalidation(community, ref) end,
      fn ref ->
        CMS.Communities.Tags.Effects.enqueue_taxonomy_changed(community, :post, ref)
      end,
      fn ref ->
        CMS.Interactions.Effects.upvote_changed(
          %CMS.Model.Article{id: "same-article"},
          %GroupherServer.Accounts.Model.User{id: 1},
          :add,
          ref
        )
      end
    ]

    assert {:ok, :verified} =
             Repo.transact_result(fn ->
               for constructor <- constructors do
                 before = Repo.aggregate(Event, :count)
                 assert {:ok, _} = constructor.(first)
                 assert {:ok, _} = constructor.(first)
                 assert Repo.aggregate(Event, :count) == before + 1
                 assert {:ok, _} = constructor.(second)
                 assert Repo.aggregate(Event, :count) == before + 2
               end

               {:ok, :verified}
             end)
  end
end
