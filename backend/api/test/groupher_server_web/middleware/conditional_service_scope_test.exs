defmodule GroupherServerWeb.Middleware.ConditionalServiceScopeTest do
  use ExUnit.Case, async: true

  alias GroupherServer.{Auth, RequestActor}
  alias GroupherServerWeb.Middleware.ConditionalServiceScope
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

      assert [[message: _message, extensions: %{code: code}]] = result.errors
      assert code == AuthContract.service_scope_forbidden()
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

    assert [[message: _message, extensions: %{code: code}]] = result.errors
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

    missing = ConditionalServiceScope.call(%Absinthe.Resolution{context: %{}}, @opts)

    assert [[message: _message, extensions: %{code: failed_code}]] = failed.errors
    assert failed_code == AuthContract.service_jwks_unavailable()
    assert [[message: _message, extensions: %{code: missing_code}]] = missing.errors
    assert missing_code == AuthContract.service_token_invalid()
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
