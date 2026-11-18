defmodule GroupherServerWeb.Resolvers.CMS.HistoryOrigin do
  @moduledoc """
  Derives content history provenance from the verified request actor.

      authenticated context -> signed origin capability -> history source and service reference
  """

  @browser "content:history:browser"
  @import "content:history:import"

  @doc "Returns a single origin, rejecting service credentials with missing or ambiguous scope."
  def from_context(%{service_actor: %{subject: subject, scopes: scopes}})
      when is_binary(subject) and byte_size(subject) > 0 and is_struct(scopes, MapSet) do
    case {MapSet.member?(scopes, @browser), MapSet.member?(scopes, @import)} do
      {true, false} -> {:ok, %{source: :browser, service_ref: subject}}
      {false, true} -> {:ok, %{source: :import, service_ref: subject}}
      _ -> {:error, :history_origin_invalid}
    end
  end

  def from_context(%{service_actor: _}), do: {:error, :history_origin_invalid}

  def from_context(%{cur_user: %GroupherServer.Accounts.Model.User{}}),
    do: {:ok, %{source: :browser, service_ref: nil}}

  def from_context(_), do: {:error, :history_origin_invalid}
end
