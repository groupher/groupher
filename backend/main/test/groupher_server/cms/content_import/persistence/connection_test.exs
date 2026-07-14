defmodule GroupherServer.CMS.ContentImport.Persistence.ConnectionTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Persistence.Connection

  test "accepts bounded public configuration and a credential locator" do
    changeset =
      Connection.changeset(%Connection{}, %{
        community_id: 1,
        platform: :github,
        source_ref: "groupher/groupher",
        connection_key: "main",
        status: :active,
        config: %{ref: "main", path: "docs"},
        credential_locator: "vault://github/installations/1"
      })

    assert changeset.valid?
  end

  test "rejects credentials nested inside public config" do
    changeset =
      Connection.changeset(%Connection{}, %{
        community_id: 1,
        platform: :github,
        source_ref: "groupher/groupher",
        connection_key: "main",
        status: :active,
        config: %{headers: %{authorization: "Bearer secret"}}
      })

    refute changeset.valid?

    assert {"must not contain credentials or authorization secrets", _} =
             changeset.errors[:config]
  end
end
