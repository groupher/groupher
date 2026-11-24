defmodule GroupherServer.TestWeb.ErrorResponse do
  @moduledoc false

  use GroupherServer.TestMate, async: true

  alias GroupherServer.{Accounts, CMS, ErrorCat, Pagi}
  alias CMS.Gate.Decision
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias Pagi.ErrorCat, as: PagiErrorCat
  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias GroupherServerWeb.ErrorResponse

  test "exposes the login reason used by current Passport fact readers" do
    error = ProfileErrorCat.account_login()

    assert {:error, [message: _, extensions: %{code: 4301, reasonCode: "ACCOUNT_LOGIN"}]} =
             ErrorResponse.format_error(error)
  end

  test "exposes stable import conflict reason codes through GraphQL" do
    for reason <- [:target_revision_conflict, :import_intent_conflict] do
      error = apply(GroupherServer.CMS.ErrorCat, reason, [])

      assert {:error, [message: _, extensions: %{reasonCode: code}]} =
               ErrorResponse.format_error(error)

      assert code == Atom.to_string(reason)
    end
  end

  test "AlertWall and AI errors survive the GraphQL boundary with declared codes" do
    for catalog <- [GroupherServer.AlertWall.ErrorCat, GroupherServer.AI.ErrorCat],
        entry <- catalog.entries() do
      error = apply(catalog, entry.reason, [])
      assert ErrorCat.valid?(error)

      assert {:error, [message: _, extensions: %{code: code}]} =
               ErrorResponse.format_error(error)

      assert code == entry.code
    end
  end

  test "formats a denied Gate decision into the public GraphQL payload" do
    decision =
      Decision.deny(
        [GateErrorCat.permission_denied(), GateErrorCat.ancestor_article_archived()],
        %{request_id: "req"}
      )

    assert {:error,
            [
              message: "当前账号没有执行此操作的权限。",
              extensions: %{
                code: 4616,
                retryable: false,
                actions: ["SHOW_PERMISSION_NOTICE"]
              }
            ]} = ErrorResponse.format_error(decision)
  end

  test "published editing denial exposes its localized message and recovery action" do
    assert {:error,
            [
              message: "此社区已关闭已发布内容的编辑。",
              extensions: %{code: 4633, retryable: false, actions: ["READ_ONLY_NOTICE"]}
            ]} = ErrorResponse.format_error(GateErrorCat.published_article_editing_disabled())
  end

  test "exposes only the bounded Pagi mismatch discriminator" do
    error = PagiErrorCat.config_mismatch(%{mismatch: :revision, private: "secret"})

    assert {:error,
            [
              message: _message,
              extensions: %{code: 4211, mismatch: "revision"}
            ]} = ErrorResponse.format_error(error)
  end

  test "exposes the other bounded Pagi mismatch value" do
    error = PagiErrorCat.config_mismatch(%{mismatch: :api, private: "secret"})

    assert {:error, [message: _message, extensions: %{code: 4211, mismatch: "api"}]} =
             ErrorResponse.format_error(error)
  end

  test "does not expose unrecognized Pagi mismatch details" do
    for mismatch <- [:tenant, nil, "revision"] do
      error = PagiErrorCat.config_mismatch(%{mismatch: mismatch, private: "secret"})

      assert {:error, [message: _message, extensions: %{code: 4211}]} =
               ErrorResponse.format_error(error)
    end
  end

  test "rejects a hand-built ErrorCat code that does not match its declaration" do
    error = %{ErrorCat.custom() | code: 987_654}

    assert_raise ArgumentError, fn -> ErrorResponse.format_error(error) end
  end
end
