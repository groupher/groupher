defmodule GroupherServer.Test.CMS.Assets.Endpoints do
  @moduledoc false

  use ExUnit.Case, async: true

  alias GroupherServer.CMS
  alias CMS.Assets.Endpoints

  test "normalizes only the requested endpoint role" do
    env = %{
      "ASSETS_HUB_BATCH_ENDPOINT" => " http://127.0.0.1:8787/ ",
      "ASSETS_PUBLIC_ENDPOINT" => "https://assets.groupher.com"
    }

    assert Endpoints.fetch("ASSETS_HUB_BATCH_ENDPOINT", env) == {:ok, "http://127.0.0.1:8787"}
    assert Endpoints.fetch("ASSETS_HUB_DELETE_ENDPOINT", env) == :error
  end

  test "fails production runtime validation with every missing role" do
    assert_raise ArgumentError,
                 "missing Assets Hub endpoints: ASSETS_HUB_BATCH_ENDPOINT, ASSETS_HUB_DELETE_ENDPOINT",
                 fn ->
                   Endpoints.validate!(
                     %{"ASSETS_PUBLIC_ENDPOINT" => "https://assets.example"},
                     :prod
                   )
                 end
  end

  test "non-production runtimes do not require external service endpoints" do
    assert :ok = Endpoints.validate!(%{}, :dev)
    assert :ok = Endpoints.validate!(%{}, :mock)
    assert :ok = Endpoints.validate!(%{}, :test)
    assert :ok = Endpoints.validate!(%{}, :seed_prod)
  end

  test "rejects malformed endpoint values" do
    assert Endpoints.fetch("ASSETS_PUBLIC_ENDPOINT", %{"ASSETS_PUBLIC_ENDPOINT" => "localhost"}) ==
             :error

    assert Endpoints.fetch("ASSETS_PUBLIC_ENDPOINT", %{"ASSETS_PUBLIC_ENDPOINT" => "ftp://x.test"}) ==
             :error
  end
end
