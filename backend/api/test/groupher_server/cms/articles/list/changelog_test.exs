defmodule GroupherServer.Test.CMS.Articles.ChangelogList do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, _, changelog_attrs, user} = mock_article(:changelog)

    {:ok, ~m(community changelog_attrs user)a}
  end

  describe "[cms changelog list]" do
    test "can get paged changelogs", ~m(community changelog_attrs user)a do
      {:ok, _} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :changelog,
          changelog_attrs,
          user
        )

      {:ok, _} =
        GroupherServer.Support.Factory.create_published_article(
          community,
          :changelog,
          changelog_attrs,
          user
        )

      {:ok, paged_changelogs} =
        CMS.Articles.page(:changelog, %{}, %GroupherServer.Pagi.Params.Offset{page: 1, size: 20})

      assert paged_changelogs |> is_map()
      assert length(paged_changelogs.entries) >= 2
      assert Enum.all?(paged_changelogs.entries, &(&1.thread == :changelog))
    end
  end
end
