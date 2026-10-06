defmodule GroupherServer.Test.CMS.Communities.Query.PageCategories do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  test "pages categories through the named community Query" do
    {:ok, category} = db_insert(:category)

    assert {:ok, result} =
             CMS.Communities.Query.page_categories(%{page: 1, size: 10})

    assert result.entries |> Enum.any?(&(&1.id == category.id))
    assert result.total_count >= 1
  end
end
