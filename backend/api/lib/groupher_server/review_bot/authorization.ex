defmodule GroupherServer.ReviewBot.Authorization do
  @moduledoc """
  Checks the existing Passport capabilities for community policy changes.

      typed ReviewBot scope -> configured review permission -> allow or deny
  """

  alias GroupherServer.CMS
  alias CMS.Model.Community

  @doc "Authorizes a ReviewBot policy action in a typed scope."
  @spec authorize(map(), :read | :configure, struct()) :: {:ok, :pass} | {:error, term()}
  def authorize(%{type: :community, community: %Community{slug: slug}}, action, actor)
      when action in [:read, :configure] do
    check_permission(actor, "review.#{action}", %{community: slug})
  end

  def authorize(_scope, _action, _actor), do: {:error, CMS.passport_error_cat_permission_denied()}

  defp check_permission(actor, action, params) do
    case CMS.passport_authorization_check(actor, action, params) do
      {:ok, true} -> {:ok, :pass}
      {:error, reason} -> {:error, reason}
      _ -> {:error, CMS.passport_error_cat_permission_denied()}
    end
  end
end
