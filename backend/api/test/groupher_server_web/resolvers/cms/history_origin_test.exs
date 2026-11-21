defmodule GroupherServer.Test.Web.Resolvers.CMS.HistoryOriginTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Accounts
  alias Accounts.Model.User
  alias GroupherServerWeb.Resolvers.CMS.HistoryOrigin

  test "only signed and unambiguous service scopes identify service origin" do
    user = %User{id: 1}

    context = %{
      cur_user: user,
      service_actor: %{
        subject: "service:publisher",
        scopes: MapSet.new(["content:history:browser"])
      }
    }

    assert {:ok, %{source: :browser, service_ref: "service:publisher"}} =
             HistoryOrigin.from_context(context)

    actor = %{context.service_actor | scopes: MapSet.new(["content:history:import"])}

    assert {:ok, %{source: :import, service_ref: "service:publisher"}} =
             HistoryOrigin.from_context(%{context | service_actor: actor})

    actor = %{actor | scopes: MapSet.new(["content:history:browser", "content:history:import"])}

    assert {:error, :history_origin_invalid} =
             HistoryOrigin.from_context(%{context | service_actor: actor})

    assert {:error, :history_origin_invalid} =
             HistoryOrigin.from_context(%{
               context
               | service_actor: %{actor | scopes: MapSet.new()}
             })

    assert {:ok, %{source: :browser, service_ref: nil}} =
             HistoryOrigin.from_context(%{cur_user: user})

    assert {:ok, %{source: :browser, service_ref: nil}} =
             HistoryOrigin.from_context(%{cur_user: user, service_actor: nil})

    assert {:error, :history_origin_invalid} = HistoryOrigin.from_context(%{})
  end
end
