defmodule GroupherServer.Test.CMS.Model.Interaction.RoaringBitmapTest do
  use GroupherServer.DataCase, async: true

  alias Ecto.Adapters.SQL
  alias GroupherServer.Repo

  test "the database provides 64-bit bitmap membership and cardinality" do
    result =
      SQL.query!(
        Repo,
        """
        SELECT
          rb64_cardinality(rb64_build(ARRAY[1, 2, 3]::bigint[])),
          rb64_build(ARRAY[1, 2, 3]::bigint[]) @> 2::bigint
        """
      )

    assert [[3, true]] = result.rows
  end
end
