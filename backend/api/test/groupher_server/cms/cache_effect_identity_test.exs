defmodule GroupherServer.Test.CMS.CacheEffectIdentityTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Outbox.Event

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
        CMS.Communities.Tags.Effects.enqueue_taxonomy_changed(community, :post, ref, "same-state")
      end,
      fn ref ->
        CMS.Interactions.Effects.enqueue_reaction_changed(
          "interaction.upvote_changed",
          "article",
          "same-article",
          ref,
          %{actor_id: 1, operation: "add"}
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
