defmodule GroupherServer.ReviewBot.Authorization do
  @moduledoc """
  Checks the existing Passport capabilities for community policy changes.

      typed ReviewBot scope -> configured review permission -> allow or deny
  """

  alias GroupherServer.CMS
  alias CMS.Model.Community

  @doc "Authorizes a ReviewBot policy action in a typed scope."
  @spec authorize(map(), :read | :configure, struct()) :: {:ok, :pass} | {:error, term()}
  def authorize(%{type: :community, community: %Community{} = community}, action, actor)
      when action in [:read, :configure] do
    check_permission(actor, "review.#{action}", %{community: community})
  end

  def authorize(_scope, _action, _actor), do: {:error, CMS.passport_error_cat_permission_denied()}

  defp check_permission(actor, action, params) do
    with %Community{} = community <- Map.get(params, :community),
         {:ok, scope} <- CMS.passport_community_scope(actor, community),
         {:ok, true} <- CMS.passport_allowed?(actor, scope, action) do
      {:ok, :pass}
    else
      {:ok, false} -> {:error, CMS.passport_error_cat_permission_denied()}
      {:error, reason} -> {:error, reason}
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end
end
