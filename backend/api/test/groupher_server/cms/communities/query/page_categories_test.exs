defmodule GroupherServer.Test.CMS.Communities.Query.PageCategories do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias CMS.Communities.Query.Contract

  test "community query contract accepts only its own filters and sort values" do
    assert {:ok, :pass} = Contract.validate_filter(%{category: "tech", sort: :most_views})

    assert {:error, %{reason: :unsupported_sort}} =
             Contract.validate_filter(%{sort: :desc_active})

    assert {:error, _} = Contract.validate_filter(%{author_id: 1})
  end

  alias GroupherServer.CMS

  test "returns the complete ordered navigation category configuration" do
    {:ok, category} = db_insert(:category)

    assert {:ok, result} =
             CMS.Communities.Query.categories()

    assert result |> Enum.any?(&(&1.id == category.id))
    assert is_list(result)
  end
end
