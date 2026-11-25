defmodule GroupherServer.ReviewBot.PolicySnapshot do
  @moduledoc """
  Builds immutable policy facts for CMS review requests.

      ReviewBot configurations -> selected scopes -> versioned policy facts
  """

  alias GroupherServer.ReviewBot
  alias ReviewBot.Model.ReviewBotConfig

  @doc "Builds snapshots for the requested review scope."
  def build(configs, trigger, requested_scope) do
    with {:ok, scopes} <- scopes(configs),
         {:ok, selected} <- select(scopes, requested_scope) do
      {:ok, Enum.map(selected, &snapshot(&1, trigger))}
    end
  end

  defp scopes(%{system: %ReviewBotConfig{} = system, community: nil}) do
    {:ok, [{:system, system, system}]}
  end

  defp scopes(%{system: %ReviewBotConfig{} = system, community: %ReviewBotConfig{} = community}) do
    {:ok, [{:system, system, system}, {{:community, community.community_id}, community, system}]}
  end

  defp scopes(%{system: %ReviewBotConfig{} = system, communities: communities})
       when is_map(communities) do
    community_scopes =
      communities
      |> Enum.sort_by(fn {id, _} -> id end)
      |> Enum.map(fn {id, %ReviewBotConfig{} = config} -> {{:community, id}, config, system} end)

    {:ok, [{:system, system, system} | community_scopes]}
  end

  defp scopes(_), do: {:error, :invalid_review_policy}

  defp select(scopes, :all), do: {:ok, scopes}

  defp select(scopes, requested) do
    case Enum.find(scopes, fn {scope, _, _} -> scope == requested end) do
      nil -> {:error, :invalid_review_policy}
      scope -> {:ok, [scope]}
    end
  end

  defp snapshot({scope, config, system}, trigger) do
    {scope_name, community_id} =
      case scope do
        :system -> {"system", nil}
        {:community, id} -> {"community:#{id}", id}
      end

    policy = %{
      "scope" => scope_name,
      "trigger" => Atom.to_string(trigger),
      "system_config_id" => system.id,
      "system_config_version" => system.version,
      "config_id" => config.id,
      "config_version" => config.version,
      "system_prompt" => system.prompt,
      "prompt" => if(scope == :system, do: "", else: config.prompt),
      "ban_words" => config.ban_words
    }

    policy =
      if scope == :system do
        policy
      else
        Map.put(policy, "review_mode", Atom.to_string(config.review_mode))
      end

    %{community_id: community_id, policy_snapshot: policy}
  end
end
