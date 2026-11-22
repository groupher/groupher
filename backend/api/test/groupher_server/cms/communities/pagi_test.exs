defmodule GroupherServer.Test.CMS.Communities.Pagi do
  use GroupherServer.TestMate

  alias Helper.ORM.Pagi.{Page}
  alias GroupherServer.{Pagi}
  alias Pagi.Params
  alias CMS.Model.CommunityModerator

  test "member pages use their own stable identity and isolate community cursors" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    {:ok, other} = mock_community(owner)
    users = for _ <- 1..4, do: elem(db_insert(:user), 1)

    for user <- Enum.reverse(users) do
      {:ok, _} = CMS.Communities.Subscriptions.Setup.subscribe(community, user)
      {:ok, _} = CMS.Communities.add_moderator(community, user, owner, Ecto.UUID.generate())
    end

    for kind <- [:subscribers, :moderators] do
      assert {:ok, %Page.Offset{entries: expected}} =
               CMS.Communities.members(kind, community, %{}, %Params.Offset{page: 1, size: 100})

      ids = Enum.map(expected, & &1.id)
      assert ids == Enum.sort(ids, :desc)

      assert {:ok, %Page.Cursor{entries: first, end_cursor: cursor, has_next_page: true}} =
               CMS.Communities.members(kind, community, %{}, %Params.Cursor{first: 2})

      assert {:ok, %Page.Cursor{entries: rest, has_next_page: false}} =
               CMS.Communities.members(kind, community, %{}, %Params.Cursor{
                 first: 100,
                 after: cursor
               })

      assert Enum.map(first ++ rest, & &1.id) == ids

      assert {:error, _} =
               CMS.Communities.members(kind, other, %{}, %Params.Cursor{first: 2, after: cursor})
    end
  end

  test "moderator pages batch metadata and candidate picker excludes memberships before limit" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)
    {:ok, target} = db_insert(:user)
    {:ok, _} = CMS.Communities.add_moderator(community, target, owner, Ecto.UUID.generate())
    {:ok, candidate} = db_insert(:user)

    Repo.update_all(
      from(m in CommunityModerator,
        where: m.community_id == ^community.id and m.user_id == ^target.id
      ),
      set: [passport_item_count: 999]
    )

    assert {:ok, %Page.Offset{entries: members}} =
             CMS.Communities.members(:moderators, community, %{}, %{offset: %{page: 1, size: 100}})

    root = Enum.find(members, &(&1.user_id == owner.id))
    assert root.is_root
    assert is_integer(root.passport_item_count)
    assert Enum.all?(members, &is_map(&1.permissions))
    refute Enum.find(members, &(&1.user_id == target.id)).passport_item_count == 999

    {_, small_queries} =
      capture_queries(fn ->
        CMS.Communities.members(:moderators, community, %{}, %{offset: %{page: 1, size: 1}})
      end)

    {_, large_queries} =
      capture_queries(fn ->
        CMS.Communities.members(:moderators, community, %{}, %{offset: %{page: 1, size: 100}})
      end)

    assert length(small_queries) > 0
    assert length(small_queries) == length(large_queries)
    assert {:ok, candidates} = CMS.Communities.moderator_candidates(community, candidate.login)
    assert Enum.any?(candidates, &(&1.id == candidate.id))
    assert {:ok, excluded} = CMS.Communities.moderator_candidates(community, target.login)
    refute Enum.any?(excluded, &(&1.id == target.id))
  end

  test "community page and actual subscription cursors expose Community identities" do
    {:ok, owner} = db_insert(:user)
    communities = for _ <- 1..4, do: elem(mock_community(owner), 1)

    for community <- Enum.reverse(communities),
        do: CMS.Communities.Subscriptions.Setup.subscribe(community, owner)

    assert {:ok, %Page.Offset{entries: expected, total_count: 4}} =
             Accounts.Profiles.subscribed_communities(owner, %{}, %Params.Offset{
               page: 1,
               size: 100
             })

    assert {:ok, %Page.Cursor{entries: first, end_cursor: cursor}} =
             Accounts.Profiles.subscribed_communities(owner, %{}, %Params.Cursor{first: 2})

    assert {:ok, %Page.Cursor{entries: rest, has_next_page: false}} =
             Accounts.Profiles.subscribed_communities(owner, %{}, %Params.Cursor{
               first: 100,
               after: cursor
             })

    assert Enum.map(first ++ rest, & &1.id) == Enum.map(expected, & &1.id)
    assert {:error, _} = CMS.Communities.paged(%{}, %Params.Cursor{first: 2, after: cursor})

    assert {:ok, %Page.Cursor{entries: visible}} =
             CMS.Communities.paged(%{}, %Params.Cursor{first: 100})

    assert Enum.all?(communities, fn community -> Enum.any?(visible, &(&1.id == community.id)) end)
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}

    event =
      GroupherServer.Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          if self() == pid, do: send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end
end
