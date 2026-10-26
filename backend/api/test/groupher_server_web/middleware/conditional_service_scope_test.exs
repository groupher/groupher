defmodule GroupherServerWeb.Middleware.ConditionalServiceScopeTest do
  use ExUnit.Case, async: true

  alias GroupherServer.{Auth, RequestActor}
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat
  alias GroupherServerWeb.Middleware.{ConditionalServiceScope, GeneralError, GQLResultFmt}
  alias Auth.Contract, as: AuthContract
  alias RequestActor.Classification

  @opts [audience: "phoenix:view-api", scope: "view:track"]

  test "keeps the public operation open to a classified browser request" do
    resolution =
      %Absinthe.Resolution{
        context: %{
          request_actor: %Classification{
            type: :human,
            confidence: :probable,
            is_authenticated: false,
            classified_by: :signed_anonymous_session
          }
        }
      }

    assert ConditionalServiceScope.call(resolution, @opts) == resolution
  end

  test "allows a service only with the exact audience and scope" do
    resolution =
      %Absinthe.Resolution{
        context: %{
          request_actor: agent_classification(),
          service_actor: service_actor()
        }
      }

    assert ConditionalServiceScope.call(resolution, @opts) == resolution
  end

  test "rejects an under-scoped or wrong-audience service instead of falling back" do
    for actor <- [
          Map.put(service_actor(), :scopes, MapSet.new(["view:read"])),
          Map.put(service_actor(), :audience, "phoenix:other-api")
        ] do
      result =
        ConditionalServiceScope.call(
          %Absinthe.Resolution{
            context: %{request_actor: agent_classification(), service_actor: actor}
          },
          @opts
        )
        |> finalize_error()

      assert [%{message: _message, extensions: %{code: code}}] = result.errors
      assert code == WebErrorCat.service_scope_forbidden().code
    end
  end

  test "rejects delegation verification failure before an otherwise authorized service" do
    result =
      ConditionalServiceScope.call(
        %Absinthe.Resolution{
          context: %{
            delegation_auth_failure: AuthContract.token_invalid(),
            request_actor: agent_classification(),
            service_actor: service_actor()
          }
        },
        @opts
      )
      |> finalize_error()

    assert [%{message: _message, extensions: %{code: code}}] = result.errors
    assert code == AuthContract.token_invalid()
  end

  test "preserves verification failure and rejects a missing classification" do
    failed =
      ConditionalServiceScope.call(
        %Absinthe.Resolution{
          context: %{service_auth_failure: AuthContract.service_jwks_unavailable()}
        },
        @opts
      )
      |> finalize_error()

    missing =
      ConditionalServiceScope.call(%Absinthe.Resolution{context: %{}}, @opts)
      |> finalize_error()

    assert [%{message: _message, extensions: %{code: failed_code}}] = failed.errors
    assert failed_code == WebErrorCat.jwks_unavailable().code
    assert [%{message: _message, extensions: %{code: missing_code}}] = missing.errors
    assert missing_code == WebErrorCat.invalid_service_token().code
  end

  defp finalize_error(resolution) do
    resolution
    |> GQLResultFmt.call([])
    |> GeneralError.call([])
  end

  defp service_actor do
    %{
      audience: "phoenix:view-api",
      scopes: MapSet.new(["view:track"]),
      subject: "service:view",
      token_id: "view-service"
    }
  end

  defp agent_classification do
    %Classification{
      type: :agent,
      confidence: :verified,
      is_authenticated: false,
      classified_by: :agent_credential
    }
  end
end
