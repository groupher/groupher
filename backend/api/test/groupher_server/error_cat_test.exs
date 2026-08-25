defmodule GroupherServer.ErrorCatTest do
  use ExUnit.Case, async: true

  alias GroupherServer.ErrorCat
  alias GroupherServer.ErrorCat.Error
  alias GroupherServer.ErrorCat.Validator

  test "catalog declarations produce structured errors" do
    error = GroupherServer.CMS.Gate.ErrorCat.article_archived("read only")

    assert %Error{
             namespace: {:cms, :gate},
             reason: :article_archived,
             code: 4609,
             retryable: false,
             actions: [:read_only_notice],
             message_key: "cms.gate.read_only",
             details: "read only"
           } = error

    assert ErrorCat.valid?(error)
    assert ErrorCat.declared?({:cms, :gate}, :article_archived)
  end

  test "catalog definition is the same complete definition used by its constructor" do
    error = GroupherServer.CMS.Articles.ErrorCat.archived("read only")
    definition = GroupherServer.CMS.Articles.ErrorCat.definition(:archived)

    assert definition == error |> Map.from_struct() |> Map.delete(:details)
    assert definition == ErrorCat.definition({:cms, :article}, :archived)
    assert ErrorCat.valid?(error)
    refute ErrorCat.valid?(%{error | code: 9999})
    refute ErrorCat.valid?(%{error | message_key: "wrong.key"})
    refute ErrorCat.valid?(%{error | retryable: true})
  end

  test "reserved definitions have the same complete shape as catalog entries" do
    assert %{
             namespace: {:web},
             reason: :custom,
             code: 4001,
             retryable: false,
             actions: [],
             message_key: "web.custom"
           } = ErrorCat.definition({:web}, :custom)

    assert ErrorCat.valid?(ErrorCat.custom("custom error"))
    assert ErrorCat.declared?({:web}, :custom)
  end

  test "global validation covers ranges, codes, and reserved codes" do
    assert :ok = ErrorCat.validate!()
    assert ErrorCat.code(GroupherServerWeb.ErrorCat.pagination()) == 4002
    assert ErrorCat.code(ErrorCat.custom()) == 4001
    assert ErrorCat.code(ErrorCat.gate_unknown()) == 4699
  end

  test "reserved validation rejects incomplete definitions" do
    assert_raise ArgumentError, ~r/reserved definition is incomplete/, fn ->
      Validator.validate!(%{{:web} => 4000..4199}, [%{namespace: {:web}}], [])
    end
  end

  test "reserved validation rejects invalid field types" do
    definition = %{
      namespace: {:web},
      reason: "default",
      code: 4000,
      retryable: false,
      actions: [],
      message_key: "web.default"
    }

    assert_raise ArgumentError, ~r/reserved reason must be an atom/, fn ->
      Validator.validate!(%{{:web} => 4000..4199}, [definition], [])
    end
  end

  test "range validation rejects empty, descending, and overlapping ranges" do
    assert_raise ArgumentError, ~r/ranges must be a non-empty map/, fn ->
      empty_ranges = Map.new([{:empty, nil}]) |> Map.delete(:empty)
      Validator.validate!(empty_ranges, [], [])
    end

    assert_raise ArgumentError, ~r/range must be an ascending range/, fn ->
      Validator.validate!(%{{:web} => 4199..4000//-1}, [], [])
    end

    assert_raise ArgumentError, ~r/code ranges overlap/, fn ->
      Validator.validate!(%{{:web} => 4000..4100, {:cms} => 4100..4200}, [], [])
    end
  end

  test "unknown global definitions raise a clear argument error" do
    assert_raise ArgumentError, ~r/unknown ErrorCat definition/, fn ->
      ErrorCat.definition({:cms, :article}, :unknown)
    end
  end

  test "formats declared errors for the GraphQL boundary" do
    error = GroupherServer.CMS.Comments.ErrorCat.comment_pin_limit("max 3 pinned comments")

    assert {:error, [message: "max 3 pinned comments", code: 4403]} =
             ErrorCat.gq_format(error)

    assert {:error, [message: "max 3 pinned comments", code: 4403]} =
             ErrorCat.gq_format({:error, error})
  end

  test "passes through an already formatted GraphQL error" do
    formatted = {:error, [message: "oops", code: 4001]}

    assert ^formatted = ErrorCat.gq_format(formatted)
  end

  test "rejects raw errors at the GraphQL boundary" do
    assert_raise ArgumentError, ~r/ErrorCat\.Error is required/, fn ->
      ErrorCat.gq_format(:unknown_reason)
    end
  end

  test "rejects an ErrorCat struct whose definition fields were changed" do
    error = GroupherServer.CMS.Articles.ErrorCat.archived()

    for changed <- [
          %{error | code: 9999},
          %{error | message_key: "wrong.message"},
          %{error | retryable: true},
          %{error | actions: [:retry]}
        ] do
      assert_raise ArgumentError, ~r/invalid ErrorCat\.Error/, fn ->
        ErrorCat.gq_format(changed)
      end
    end
  end

  test "allows details to vary when formatting a declared error" do
    error = GroupherServer.CMS.Articles.ErrorCat.archived(%{message: "read only"})

    assert {:error, [message: "read only", code: 6004]} = ErrorCat.gq_format(error)
  end
end
