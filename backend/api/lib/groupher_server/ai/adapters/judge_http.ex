defmodule GroupherServer.AI.Adapters.JudgeHTTP do
  @moduledoc """
  Calls an operator-hosted judge endpoint and validates a limited moderation opinion.

  Business position:

      ReviewBot policy check
        -> AI.check/1
          -> JudgeHTTP request
            -> bounded OpinionOutput

  """
  alias GroupherServer.AI

  @behaviour GroupherServer.AI.Adapter

  alias AI.{ErrorCat, OpinionInput, OpinionOutput}

  @timeout 15_000
  @max_body_bytes 2 * 1024 * 1024

  @doc "Submits a moderation opinion to the operator-hosted judge service."
  @impl true
  @spec check(OpinionInput.t(), map()) :: {:ok, OpinionOutput.t()} | {:error, term()}
  def check(%OpinionInput{} = input, %{base_url: base_url, credential: credential, model: model}) do
    with {:ok, :pass} <- validate_opinion_size(input),
         {:ok, response} <- post(base_url, credential, opinion_request_body(input, model)),
         {:ok, opinion} <- OpinionOutput.validate(response, input) do
      {:ok, opinion}
    end
  end

  def check(_input, _profile), do: {:error, ErrorCat.invalid_config()}

  @doc "Builds the provider-neutral moderation body without content identity fields."
  @spec opinion_request_body(OpinionInput.t(), String.t()) :: map()
  def opinion_request_body(%OpinionInput{} = input, model) do
    %{
      "model" => model,
      "systemPrompt" => input.system_prompt,
      "prompt" => input.prompt,
      "banWords" => input.ban_words,
      "text" => %{"title" => input.text.title, "body" => input.text.body},
      "images" => Enum.map(input.images || [], &image_payload/1),
      "requiredModalities" => Enum.map(input.required_modalities, &Atom.to_string/1)
    }
  end

  defp image_payload(image) do
    %{
      "assetId" => Map.get(image, :asset_id),
      "immutableVersion" => Map.get(image, :immutable_version),
      "signedReadUrl" => Map.get(image, :signed_read_url)
    }
  end

  defp valid_image?(image) when is_map(image) do
    url = Map.get(image, :signed_read_url)

    case URI.parse(url || "") do
      %URI{scheme: "https", host: host, userinfo: nil} when is_binary(host) and host != "" ->
        is_binary(Map.get(image, :immutable_version))

      _ ->
        false
    end
  end

  defp valid_image?(_image), do: false

  defp validate_opinion_size(input) do
    body = Jason.encode!(opinion_request_body(input, "model"))

    if byte_size(body) <= @max_body_bytes and length(input.images || []) <= 10 and
         Enum.all?(input.images || [], &valid_image?/1) do
      {:ok, :pass}
    else
      {:error, ErrorCat.coverage_incomplete()}
    end
  end

  defp post(base_url, credential, body) do
    client =
      Tesla.client(
        [
          {Tesla.Middleware.BaseUrl, base_url},
          Tesla.Middleware.JSON,
          {Tesla.Middleware.Headers, [{"authorization", "Bearer " <> credential}]}
        ],
        {Tesla.Adapter.Finch,
         name: GroupherServer.Finch, receive_timeout: @timeout, request_timeout: @timeout}
      )

    case Tesla.post(client, "/v1/judge", body) do
      {:ok, %Tesla.Env{status: status, body: response}}
      when status in 200..299 and is_map(response) ->
        {:ok, response}

      {:ok, %Tesla.Env{status: status}} when status == 429 or status >= 500 ->
        {:error, ErrorCat.provider_unavailable()}

      {:ok, %Tesla.Env{status: status}} when status in 200..299 ->
        {:error, ErrorCat.provider_protocol_error()}

      {:ok, %Tesla.Env{}} ->
        {:error, ErrorCat.provider_protocol_error()}

      {:error, _reason} ->
        {:error, ErrorCat.provider_unavailable()}
    end
  end
end
