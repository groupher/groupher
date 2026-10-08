defmodule GroupherServer.CMS.Assets.GeneratedBatch do
  @moduledoc """
  Phoenix client for the Assets Hub generated-image Batch boundary.

  Phoenix creates signed browser capabilities, while Assets Hub persists the
  temporary Batch and owns the atomic publish/delete claim. This module only
  performs the service-authenticated claim call and returns the frozen result.

  Wallpaper publish
    -> service-authenticated Assets Hub claim/cleanup
    -> frozen generated Batch result
  """

  alias GroupherServer.{CMS, ServiceAuth}
  alias ServiceAuth.Client
  alias CMS.Wallpaper.ErrorCat

  @timeout 5_000

  @doc "Claims a complete generated-image Batch for one idempotent publish key."
  @spec claim_for_publish(String.t(), String.t()) :: {:ok, map()} | {:error, term()}
  def claim_for_publish(batch_ref, idempotency_key)
      when is_binary(batch_ref) and is_binary(idempotency_key) do
    with {:ok, endpoint} <- endpoint(),
         {:ok, service_token} <-
           Client.token(
             "https://assets.groupher.com/internal",
             ["assets:generated-batch:claim"]
           ),
         {:ok, response} <-
           Req.post("#{endpoint}/generated-batches/#{batch_ref}/claim",
             json: %{key: idempotency_key},
             headers: [authorization: "Bearer #{service_token}"],
             receive_timeout: @timeout,
             retry: false
           ),
         true <- response.status in 200..299 do
      case response.body do
        %{"ok" => true, "result" => result} -> {:ok, result}
        body -> {:error, claim_error(body)}
      end
    else
      false -> {:error, claim_error(nil)}
      {:error, reason} -> {:error, claim_error(reason)}
    end
  rescue
    exception -> {:error, claim_error(Exception.message(exception))}
  end

  @doc "Deletes generated assets after a publish claim becomes an orphan."
  @spec delete_claim(String.t(), String.t()) :: {:ok, :pass} | {:error, term()}
  def delete_claim(batch_ref, publish_capability)
      when is_binary(batch_ref) and is_binary(publish_capability) do
    with {:ok, endpoint} <- endpoint(),
         {:ok, service_token} <-
           Client.token("https://assets.groupher.com/internal", ["assets:generated-batch:cleanup"]),
         {:ok, response} <-
           Req.post("#{endpoint}/generated-batches/#{batch_ref}/cleanup",
             json: %{capability: publish_capability},
             headers: [authorization: "Bearer #{service_token}"],
             receive_timeout: @timeout,
             retry: false
           ),
         true <- response.status in 200..299 do
      case response.body do
        %{"ok" => true} -> {:ok, :pass}
        body -> {:error, cleanup_error(body)}
      end
    else
      false -> {:error, cleanup_error(nil)}
      {:error, reason} -> {:error, cleanup_error(reason)}
    end
  rescue
    exception -> {:error, cleanup_error(Exception.message(exception))}
  end

  defp claim_error(reason) do
    case upstream_code(reason) do
      "GENERATED_IMAGE_BATCH_ALREADY_CLAIMED" ->
        ErrorCat.wallpaper_publish_idempotency_conflict(%{
          message:
            "This wallpaper publish request is already being processed. Retry with the latest version.",
          upstream_code: "GENERATED_IMAGE_BATCH_ALREADY_CLAIMED"
        })

      "GENERATED_IMAGE_BATCH_CLAIM_EXPIRED" ->
        ErrorCat.wallpaper_publish_lease_too_short(%{
          message: "The wallpaper publish lease expired. Please retry.",
          upstream_code: "GENERATED_IMAGE_BATCH_CLAIM_EXPIRED"
        })

      "GENERATED_IMAGE_BATCH_INCOMPLETE_MANIFEST" ->
        ErrorCat.wallpaper_upload_images_invalid(%{
          message: "Wallpaper images are incomplete. Please export all profiles again.",
          upstream_code: "GENERATED_IMAGE_BATCH_INCOMPLETE_MANIFEST"
        })

      _ ->
        ErrorCat.wallpaper_assets_hub_claim_failed(%{
          message: "Wallpaper generated assets are not ready to publish. Please retry.",
          upstream: inspect(reason)
        })
    end
  end

  defp cleanup_error(reason) do
    ErrorCat.wallpaper_assets_hub_cleanup_failed(%{
      message: "Wallpaper generated assets cleanup is pending and will be retried.",
      upstream: inspect(reason)
    })
  end

  defp upstream_code(%{"error" => %{"code" => code}}) when is_binary(code) do
    upstream_code(code)
  end

  defp upstream_code(%{"error" => code}) when is_binary(code), do: upstream_code(code)
  defp upstream_code(%{error: %{code: code}}) when is_binary(code), do: upstream_code(code)
  defp upstream_code(%{error: code}) when is_binary(code), do: upstream_code(code)

  defp upstream_code(%{"message" => message}) when is_binary(message), do: upstream_code(message)
  defp upstream_code(%{message: message}) when is_binary(message), do: upstream_code(message)

  defp upstream_code(value) when is_binary(value) do
    case Regex.run(~r/GENERATED_IMAGE_BATCH_[A-Z_]+/, value) do
      [code] -> code
      _ -> nil
    end
  end

  defp upstream_code(_), do: nil

  defp endpoint do
    case GroupherServer.CMS.Assets.Endpoints.fetch("ASSETS_HUB_BATCH_ENDPOINT") do
      {:ok, endpoint} -> {:ok, endpoint}
      :error -> {:error, :assets_hub_batch_endpoint_missing}
    end
  end
end
