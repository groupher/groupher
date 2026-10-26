defmodule GroupherServer.ReviewBot do
  @moduledoc """
  Applies platform and community policy to content through the shared AI capability.

  Business position:

      CMS supplies scoped policy and content
        -> ReviewBot evaluates system and community layers
          -> AI.check/1
            -> bounded opinion returned to CMS

  """

  alias __MODULE__.ErrorCat
  alias __MODULE__.Config, as: ReviewBotConfig
  alias GroupherServer.ReviewBot
  alias __MODULE__.Commands.UpdateConfig

  @doc "Authorizes access to one system or community policy scope."
  defdelegate authorize(scope, action, actor), to: GroupherServer.ReviewBot.Authorization

  @doc "Returns the invalid ReviewBot configuration error."
  defdelegate invalid_config_error(), to: ErrorCat, as: :invalid_config

  @doc "Returns the missing ReviewBot configuration error."
  defdelegate config_not_found_error(), to: ErrorCat, as: :config_not_found

  @doc "Reads the platform and community policy snapshot for a content type."
  defdelegate configs_for_target(community_id, subject_type), to: ReviewBotConfig

  @doc "Reads the system and optional community policy for one content target."
  defdelegate configs(community_id, subject_type), to: ReviewBotConfig

  @doc "Reads the platform and community policies for multiple Article bindings."
  defdelegate configs_for_targets(community_ids, subject_type), to: ReviewBotConfig

  @doc "Creates Article and Comment defaults in the caller's community transaction."
  defdelegate create_default_configs_for_community(community_id), to: ReviewBotConfig

  @doc "Reads a config by its opaque identifier for Receipt recovery."
  defdelegate config_by_id(config_id), to: ReviewBotConfig

  @doc "Updates a scoped ReviewBot policy through its receipt-backed Command."
  defdelegate update_config(scope, subject_type, expected_version, attrs, actor, command_id),
    to: UpdateConfig,
    as: :execute

  @spec check(map(), map() | struct()) :: {:ok, map()} | {:error, term()}
  def check(content, %{system: system, community: community}) when is_map(content) do
    with {:ok, normalized_content} <- normalize_content(content),
         {:ok, system_policy} <- normalize_policy(system),
         {:ok, system_result} <- check_layer(normalized_content, system_policy, ""),
         {:ok, community_result} <- check_community(normalized_content, system_policy, community) do
      {:ok, %{system: system_result, community: community_result}}
    end
  end

  def check(content, policy) when is_map(content) do
    with {:ok, normalized_content} <- normalize_content(content),
         {:ok, normalized_policy} <- normalize_policy(policy) do
      check_layer(normalized_content, normalized_policy, normalized_policy.prompt)
    end
  end

  defp check_community(_content, _system_policy, nil), do: {:ok, nil}

  defp check_community(content, system_policy, community) do
    with {:ok, policy} <- normalize_policy(community) do
      check_layer(content, system_policy, policy.prompt, policy.ban_words)
    end
  end

  defp check_layer(content, policy, prompt, ban_words \\ nil) do
    input_attrs = %{
      system_prompt: policy.system_prompt,
      prompt: prompt || "",
      ban_words: ban_words || policy.ban_words,
      text: %{title: content.title, body: content.body},
      images: content.images,
      required_modalities: required_modalities(content)
    }

    with {:ok, input} <- GroupherServer.AI.new_opinion_input(input_attrs),
         {:ok, opinion} <- GroupherServer.AI.check(input) do
      {:ok,
       %{
         status: opinion.status,
         sus_notes: opinion.sus_notes,
         coverage: opinion.coverage,
         summary: opinion.summary
       }}
    end
  end

  defp normalize_content(%{title: title, body: body} = content)
       when is_binary(title) and is_binary(body) do
    {:ok, %{title: title, body: body, images: Map.get(content, :images, [])}}
  end

  defp normalize_content(%{text: %{title: title, body: body}} = content)
       when is_binary(title) and is_binary(body) do
    {:ok, %{title: title, body: body, images: Map.get(content, :images, [])}}
  end

  defp normalize_content(%{"title" => title, "body" => body} = content)
       when is_binary(title) and is_binary(body) do
    {:ok, %{title: title, body: body, images: Map.get(content, "images", [])}}
  end

  defp normalize_content(%{"text" => %{"title" => title, "body" => body}} = content)
       when is_binary(title) and is_binary(body) do
    {:ok, %{title: title, body: body, images: Map.get(content, "images", [])}}
  end

  defp normalize_content(_content), do: {:error, ErrorCat.invalid_config()}

  defp normalize_policy(%ReviewBot.Model.ReviewBotConfig{} = config) do
    {:ok,
     %{
       system_prompt: config.prompt,
       prompt: config.prompt,
       ban_words: config.ban_words
     }}
  end

  defp normalize_policy(%{system_prompt: system_prompt, prompt: prompt, ban_words: ban_words})
       when is_binary(system_prompt) and is_binary(prompt) and is_list(ban_words) do
    {:ok, %{system_prompt: system_prompt, prompt: prompt, ban_words: ban_words}}
  end

  defp normalize_policy(%{
         "system_prompt" => system_prompt,
         "prompt" => prompt,
         "ban_words" => ban_words
       })
       when is_binary(system_prompt) and is_binary(prompt) and is_list(ban_words) do
    {:ok, %{system_prompt: system_prompt, prompt: prompt, ban_words: ban_words}}
  end

  defp normalize_policy(_policy), do: {:error, ErrorCat.invalid_config()}

  defp required_modalities(content) do
    modalities =
      []
      |> maybe_add_text(String.trim(content.title) != "" or String.trim(content.body) != "")
      |> maybe_add_image(content.images != [])

    Enum.reverse(modalities)
  end

  defp maybe_add_text(modalities, true), do: [:text | modalities]
  defp maybe_add_text(modalities, false), do: modalities
  defp maybe_add_image(modalities, true), do: [:image | modalities]
  defp maybe_add_image(modalities, false), do: modalities
end
