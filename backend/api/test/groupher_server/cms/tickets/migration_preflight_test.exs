defmodule GroupherServer.Test.CMS.Tickets.MigrationPreflightTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias GroupherServer.Repo

  test "legacy TicketSource cutover preflight is retired with the Doc lifecycle table" do
    assert [[nil]] = Repo.query!("SELECT to_regclass('cms.doc_lifecycles')").rows
    assert [[nil]] = Repo.query!("SELECT to_regclass('cms.docs_history_owners')").rows
  end
end
