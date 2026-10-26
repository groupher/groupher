defmodule GroupherServer.ReviewBot.Config do
  @moduledoc """
  Reads ReviewBot-owned platform and community policies and initializes new communities.

      CMS community ids -> ReviewBot config rows -> fixed policy snapshots
  """

  import Ecto.Query

  alias GroupherServer.{Repo, ReviewBot}
  alias ReviewBot.Model.ReviewBotConfig

  @doc "Returns the platform policy and, for Article/Comment, the community policy."
  @spec configs_for_target(pos_integer() | nil, :article | :comment | :doc) ::
          {:ok, %{system: ReviewBotConfig.t(), community: ReviewBotConfig.t() | nil}}
          | {:error, term()}
  def configs_for_target(community_id, subject_type)
      when subject_type in [:article, :comment] and
             (is_integer(community_id) or is_nil(community_id)) do
    with {:ok, system} <- get_config(nil, subject_type),
         {:ok, community} <- get_optional_config(community_id, subject_type) do
      {:ok, %{system: system, community: community}}
    end
  end

  def configs_for_target(community_id, :doc)
      when is_integer(community_id) or is_nil(community_id) do
    with {:ok, system} <- get_config(nil, :doc) do
      {:ok, %{system: system, community: nil}}
    end
  end

  def configs_for_target(_community_id, _subject_type) do
    {:error, ReviewBot.ErrorCat.invalid_config()}
  end

  @doc "Reads system and optional community policies through ReviewBot's config boundary."
  def configs(community_id, subject_type), do: configs_for_target(community_id, subject_type)

  @doc "Returns the platform policy and every requested community policy for a multi-bound Article."
  @spec configs_for_targets([pos_integer()], :article | :comment) ::
          {:ok,
           %{
             system: ReviewBotConfig.t(),
             communities: %{optional(pos_integer()) => ReviewBotConfig.t()}
           }}
          | {:error, term()}
  def configs_for_targets(community_ids, subject_type)
      when is_list(community_ids) and subject_type in [:article, :comment] do
    ids = community_ids |> Enum.uniq() |> Enum.sort()

    with {:ok, system} <- get_config(nil, subject_type),
         configs <-
           Repo.all(
             from(config in ReviewBotConfig,
               where: config.community_id in ^ids and config.subject_type == ^subject_type
             )
           ),
         true <- length(configs) == length(ids) do
      {:ok, %{system: system, communities: Map.new(configs, &{&1.community_id, &1})}}
    else
      false -> {:error, ReviewBot.ErrorCat.config_not_found()}
      {:error, _reason} = error -> error
    end
  end

  def configs_for_targets(_community_ids, _subject_type) do
    {:error, ReviewBot.ErrorCat.invalid_config()}
  end

  @doc "Creates the two default community policies inside the caller's community transaction."
  @spec create_default_configs_for_community(pos_integer()) ::
          {:ok, [ReviewBotConfig.t()]} | {:error, term()}
  def create_default_configs_for_community(community_id) when is_integer(community_id) do
    if Repo.in_transaction?() do
      Enum.reduce_while([:article, :comment], {:ok, []}, fn subject_type, {:ok, configs} ->
        attrs = %{
          community_id: community_id,
          subject_type: subject_type,
          review_mode: :immediate,
          ban_words: [],
          prompt: "",
          version: 1
        }

        case get_config(community_id, subject_type) do
          {:ok, config} ->
            {:cont, {:ok, [config | configs]}}

          {:error, _reason} ->
            case Repo.insert(ReviewBotConfig.changeset(%ReviewBotConfig{}, attrs)) do
              {:ok, config} -> {:cont, {:ok, [config | configs]}}
              {:error, reason} -> {:halt, {:error, reason}}
            end
        end
      end)
      |> case do
        {:ok, configs} -> {:ok, Enum.reverse(configs)}
        {:error, reason} -> {:error, reason}
      end
    else
      {:error, :review_bot_config_requires_transaction}
    end
  end

  def create_default_configs_for_community(_community_id) do
    {:error, ReviewBot.ErrorCat.invalid_config()}
  end

  defp get_config(community_id, subject_type) do
    query = from(config in ReviewBotConfig, where: config.subject_type == ^subject_type)

    query =
      if is_nil(community_id),
        do: where(query, [config], is_nil(config.community_id)),
        else: where(query, [config], config.community_id == ^community_id)

    case Repo.one(query) do
      %ReviewBotConfig{} = config -> {:ok, config}
      nil -> {:error, ReviewBot.ErrorCat.config_not_found()}
    end
  end

  @doc "Reads one config by its opaque identifier for command result recovery."
  @spec config_by_id(Ecto.UUID.t()) :: {:ok, ReviewBotConfig.t()} | {:error, term()}
  def config_by_id(config_id) when is_binary(config_id) do
    case Repo.get(ReviewBotConfig, config_id) do
      %ReviewBotConfig{} = config -> {:ok, config}
      nil -> {:error, ReviewBot.ErrorCat.config_not_found()}
    end
  end

  def config_by_id(_config_id), do: {:error, ReviewBot.ErrorCat.config_not_found()}

  defp get_optional_config(nil, _subject_type), do: {:ok, nil}
  defp get_optional_config(community_id, subject_type), do: get_config(community_id, subject_type)
end
