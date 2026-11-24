defmodule Helper.ORM.ConnectionConfigTest do
  use ExUnit.Case, async: true

  alias Helper.ORM.ConnectionConfig

  test "normalizes each supported binding policy before Ecto merges URL options" do
    for {value, expected} <- [{"require", :require}, {"prefer", :prefer}, {"disable", :disable}] do
      url =
        "ecto://probe:p%40ss@localhost:5432/example?sslmode=require&channel_binding=#{value}&timeout=5000"

      assert {:ok, options} = ConnectionConfig.from_url(url)
      resolved = Keyword.merge(options, Ecto.Repo.Supervisor.parse_url(options[:url]))
      assert resolved[:channel_binding] == expected
      assert resolved[:password] == "p@ss"
      assert resolved[:hostname] == "localhost"
      assert resolved[:port] == 5432
      assert resolved[:database] == "example"
      assert resolved[:timeout] == 5000
      assert resolved[:sslmode] == "require"
      refute URI.decode_query(URI.parse(options[:url]).query || "")["channel_binding"]
    end
  end

  test "a sole binding parameter is removed without leaving an empty query" do
    assert {:ok, options} =
             ConnectionConfig.from_url("ecto://localhost/example?channel_binding=require")

    assert options == [url: "ecto://localhost/example", channel_binding: :require]
  end

  test "URLs without the binding policy retain their exact bytes and driver defaults" do
    for url <- [
          "ecto://probe:p%40ss@localhost/example",
          "ecto://localhost/example?ssl=true&timeout=5000"
        ] do
      assert {:ok, [url: ^url]} = ConnectionConfig.from_url(url)
    end
  end

  test "unsupported and duplicate policies fail closed without returning credentials" do
    for query <- [
          "channel_binding=invalid",
          "channel_binding=",
          "channel_binding=require&channel_binding=disable"
        ] do
      assert {:error, :invalid_channel_binding} =
               ConnectionConfig.from_url("ecto://probe:private@localhost/example?#{query}")
    end

    assert {:error, :invalid_database_url} = ConnectionConfig.from_url(nil)
    assert {:error, :invalid_database_url} = ConnectionConfig.from_url("not a database URL")
  end
end
