defmodule GroupherServer.Test.CMS.Articles.ChangelogList do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, _, changelog_attrs, user} = mock_article(:changelog)

    {:ok, ~m(community changelog_attrs user)a}
  end

  describe "[cms changelog list]" do
    test "can get paged changelogs", ~m(community changelog_attrs user)a do
      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :changelog, changelog_attrs, user)

      {:ok, paged_changelogs} = CMS.Articles.page(:changelog, %{page: 1, size: 20})

      assert paged_changelogs |> is_valid_pagination?(:raw)
      assert length(paged_changelogs.entries) >= 2
      assert Enum.all?(paged_changelogs.entries, &(&1.meta.thread == "CHANGELOG"))
    end
  end
end
