defmodule GroupherServer.CMS.Communities.Admins.Requests.Rules do
  @moduledoc """
  Validates request proposals, decisions and expiration without writing state.

  The owning Command locks and authorizes the Community, users, membership and
  request before using these rules; they do not authorize the caller.

      locked request facts -> Rules -> validated transition inputs -> command
  """

  alias GroupherServer.CMS
  alias CMS.Model.CommunityAdminRequest
  alias CMS.Passport.Catalog

  @doc """
  Returns a normalized grantable Community permission map.

  ## Examples

      Rules.proposal(%{"community.read" => true})
  """
  def proposal(permissions), do: Catalog.validate_permissions(:community, permissions)

  @doc """
  Checks that an acceptance respects its immutable proposal and dependencies.

  ## Examples

      Rules.approve(request, approved_permissions)
  """
  def approve(%CommunityAdminRequest{type: type, proposed_permissions: proposed}, approved)
      when type in [:invite, :apply] and is_map(proposed) and is_map(approved) do
    with {:ok, proposed} <- proposal(proposed),
         {:ok, approved} <- proposal(approved),
         true <-
           Enum.all?(approved, fn {key, value} -> value != true or proposed[key] == true end),
         true <- type != :invite or approved == proposed do
      {:ok, approved}
    else
      false -> {:error, :approval_outside_proposal}
      {:error, _} = error -> error
    end
  end

  def approve(_, _), do: {:error, :invalid_request_approval}

  @doc """
  Reports whether a pending request has reached its UTC expiration time.

  ## Examples

      Rules.expired?(request, DateTime.utc_now())
  """
  def expired?(
        %CommunityAdminRequest{status: :pending, expires_at: %DateTime{} = expires_at},
        %DateTime{} = now
      ) do
    {:ok, DateTime.compare(expires_at, now) in [:lt, :eq]}
  end

  def expired?(%CommunityAdminRequest{}, %DateTime{}), do: {:ok, false}
  def expired?(_, _), do: {:error, :invalid_request_expiration}

  @doc """
  Validates the pending state, expected revision and deadline under the request lock.

  ## Examples

      Rules.pending(request, request.revision, DateTime.utc_now())
  """
  def pending(
        %CommunityAdminRequest{status: :pending, revision: revision} = request,
        revision,
        %DateTime{} = now
      ) do
    case expired?(request, now) do
      {:ok, false} -> {:ok, :pass}
      {:ok, true} -> {:error, :request_expired}
      {:error, _} = error -> error
    end
  end

  def pending(%CommunityAdminRequest{status: :pending}, _revision, %DateTime{}) do
    {:error, :request_revision_conflict}
  end

  def pending(%CommunityAdminRequest{}, _revision, %DateTime{}) do
    {:error, :request_already_decided}
  end

  def pending(_, _, _), do: {:error, :invalid_request}
end
