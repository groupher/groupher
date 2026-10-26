defmodule GroupherServer.Test.CMS.Gate.Decision do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.{CMS, ErrorCat}
  alias CMS.Gate.Decision
  alias CMS.Gate.ErrorCat, as: GateErrorCat

  test "structured decisions preserve reasons and choose the stable primary" do
    decision =
      Decision.deny(
        [GateErrorCat.permission_denied(), GateErrorCat.ancestor_article_archived()],
        %{request_id: "req"}
      )

    refute decision.allowed
    assert decision.context == %{request_id: "req"}
    assert decision.primary.reason == :ancestor_article_archived
    assert decision.primary.err_code == 4606

    assert Enum.map(decision.violations, & &1.reason) == [
             :permission_denied,
             :ancestor_article_archived
           ]
  end

  test "unknown reasons fail closed to the reserved Gate code" do
    metadata = Decision.deny(ErrorCat.gate_unknown()).primary

    assert metadata.reason == :gate_unknown
    assert metadata.err_code == 4699
    assert metadata.source == :resource
  end
end
