defmodule GroupherServer.AI.Config do
  @moduledoc """
  Runtime registry for operator-approved provider profiles.

      AI profile id -> Config.profile/1 -> approved provider settings
  """

  @modalities [:text, :image]

  @doc "Builds provider profiles only for providers with complete operator credentials."
  @spec profiles_from_env(map()) :: map()
  def profiles_from_env(env) when is_map(env) do
    %{}
    |> maybe_add_judge_profile(env)
    |> maybe_add_openai_profile(env)
  end

  @doc "Returns the operator-approved profile selected by a ruleset."
  @spec profile(String.t() | nil) :: {:ok, map()} | {:error, term()}
  def profile(profile_id) when is_binary(profile_id) and profile_id != "" do
    profiles =
      Application.get_env(:groupher_server, :ai, []) |> Keyword.get(:profiles, %{})

    case Map.fetch(profiles, profile_id) do
      {:ok, profile} -> validate(profile)
      :error -> {:error, GroupherServer.AI.ErrorCat.config_not_found()}
    end
  end

  def profile(_profile_id), do: {:error, GroupherServer.AI.ErrorCat.config_not_found()}

  @doc "Returns the one explicitly selected moderation profile after modality validation."
  @spec review_profile([:text | :image]) :: {:ok, map()} | {:error, term()}
  def review_profile(required_modalities) when is_list(required_modalities) do
    profile_id = Application.get_env(:groupher_server, :ai, []) |> Keyword.get(:review_profile_id)

    with true <-
           required_modalities != [] and Enum.all?(required_modalities, &(&1 in @modalities)),
         {:ok, profile} <- profile(profile_id),
         true <- Enum.all?(required_modalities, &(&1 in profile.modalities)) do
      {:ok, profile}
    else
      {:error, _reason} = error -> error
      _ -> {:error, GroupherServer.AI.ErrorCat.invalid_config()}
    end
  end

  def review_profile(_required_modalities) do
    {:error, GroupherServer.AI.ErrorCat.invalid_config()}
  end

  @doc "Resolves an adapter module for a validated provider profile."
  @spec adapter(map()) :: {:ok, module()} | {:error, term()}
  def adapter(%{adapter: adapter}) do
    case GroupherServer.AI.Adapters.fetch(adapter) do
      {:ok, module} -> {:ok, module}
      :error -> {:error, GroupherServer.AI.ErrorCat.invalid_config()}
    end
  end

  def adapter(_profile), do: {:error, GroupherServer.AI.ErrorCat.invalid_config()}

  defp validate(profile) when is_map(profile) do
    base_url = Map.get(profile, :base_url)
    modalities = Map.get(profile, :modalities)
    model = Map.get(profile, :model)
    credential_env = Map.get(profile, :credential_env)

    with true <- valid_adapter?(Map.get(profile, :adapter)),
         true <- valid_https_url?(base_url),
         true <- is_binary(model) and model != "",
         true <- is_binary(credential_env) and credential_env != "",
         true <-
           is_list(modalities) and modalities != [] and
             Enum.all?(modalities, &(&1 in @modalities)),
         credential when is_binary(credential) and credential != "" <-
           System.get_env(credential_env) do
      {:ok,
       %{
         adapter: Map.get(profile, :adapter),
         base_url: base_url,
         model: model,
         credential: credential,
         modalities: Enum.uniq(modalities)
       }}
    else
      nil -> {:error, GroupherServer.AI.ErrorCat.config_not_found()}
      _ -> {:error, GroupherServer.AI.ErrorCat.invalid_config()}
    end
  end

  defp validate(_profile), do: {:error, GroupherServer.AI.ErrorCat.invalid_config()}

  defp valid_adapter?(adapter), do: GroupherServer.AI.Adapters.supported?(adapter)

  defp maybe_add_judge_profile(profiles, env) do
    url = Map.get(env, "REVIEW_BOT_JUDGE_URL")
    token = Map.get(env, "REVIEW_BOT_JUDGE_TOKEN")

    if present?(url) and present?(token) do
      Map.put(profiles, "judge_http", %{
        adapter: :judge_http,
        base_url: url,
        model: Map.get(env, "REVIEW_BOT_JUDGE_MODEL") || "default",
        credential_env: "REVIEW_BOT_JUDGE_TOKEN",
        modalities: @modalities
      })
    else
      profiles
    end
  end

  defp maybe_add_openai_profile(profiles, env) do
    if present?(Map.get(env, "REVIEW_BOT_OPENAI_TOKEN")) do
      Map.put(profiles, "openai", %{
        adapter: :openai,
        base_url: "https://api.openai.com/v1/responses",
        model: Map.get(env, "REVIEW_BOT_OPENAI_MODEL") || "gpt-5-mini",
        credential_env: "REVIEW_BOT_OPENAI_TOKEN",
        modalities: @modalities
      })
    else
      profiles
    end
  end

  defp present?(value), do: is_binary(value) and String.trim(value) != ""

  defp valid_https_url?(url) when is_binary(url) do
    case URI.parse(url) do
      %URI{scheme: "https", host: host, userinfo: nil, query: nil, fragment: nil}
      when is_binary(host) and host != "" ->
        true

      _ ->
        false
    end
  end

  defp valid_https_url?(_url), do: false
end
