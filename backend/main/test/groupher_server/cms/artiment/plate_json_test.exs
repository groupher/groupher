defmodule GroupherServer.Test.CMS.Artiment.PlateJSON do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Artiment.PlateJSON

  test "accepts a Plate root list" do
    body = Jason.encode!([%{"type" => "p", "children" => [%{"text" => "hello"}]}])

    assert {:ok, [%{"type" => "p"}]} = PlateJSON.decode(body)
  end

  test "rejects malformed JSON and non-list roots" do
    assert {:error, %Jason.DecodeError{}} = PlateJSON.decode("not-json")
    assert {:error, :invalid_plate_json} = PlateJSON.decode(~s({"type":"p"}))
    assert {:error, :invalid_body} = PlateJSON.decode(nil)
  end
end
