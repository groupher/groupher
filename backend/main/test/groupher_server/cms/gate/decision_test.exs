defmodule GroupherServer.Test.CMS.Gate.Decision do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias CMS.Gate.Decision
  alias GroupherServerWeb.Middleware.GQLResultFmt

  test "structured decisions preserve reasons and choose the stable primary" do
    decision =
      Decision.deny([:permission_denied, :ancestor_article_archived], %{request_id: "req"})

    refute decision.allowed
    assert decision.context == %{request_id: "req"}
    assert decision.primary.reason == :ancestor_article_archived
    assert decision.primary.err_code == 4606

    assert Enum.map(decision.violations, & &1.reason) == [
             :permission_denied,
             :ancestor_article_archived
           ]

    assert %{
             code: 4606,
             retryable: false,
             actions: ["READ_ONLY_NOTICE"],
             message: "当前内容处于只读状态。"
           } = GQLResultFmt.public_error(decision)

    assert {:error,
            [
              message: "当前内容处于只读状态。",
              extensions: %{
                code: 4606,
                retryable: false,
                actions: ["READ_ONLY_NOTICE"]
              }
            ]} = GQLResultFmt.graphql_error(decision)
  end

  test "unknown reasons fail closed to the reserved Gate code" do
    metadata = Decision.deny(:unexpected_gate_reason).primary

    assert metadata.reason == :gate_unknown
    assert metadata.err_code == 4699
    assert metadata.source == :resource
  end
end
