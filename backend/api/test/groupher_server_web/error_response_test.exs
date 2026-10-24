defmodule GroupherServer.TestWeb.ErrorResponse do
  @moduledoc false

  use GroupherServer.TestMate, async: true

  alias GroupherServer.{CMS, ErrorCat, Pagi}
  alias CMS.Gate.Decision
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias Pagi.ErrorCat, as: PagiErrorCat
  alias GroupherServerWeb.ErrorResponse

  test "formats a denied Gate decision into the public GraphQL payload" do
    decision =
      Decision.deny(
        [GateErrorCat.permission_denied(), GateErrorCat.ancestor_article_archived()],
        %{request_id: "req"}
      )

    assert {:error,
            [
              message: "当前内容处于只读状态。",
              extensions: %{
                code: 4606,
                retryable: false,
                actions: ["READ_ONLY_NOTICE"]
              }
            ]} = ErrorResponse.format_error(decision)
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
