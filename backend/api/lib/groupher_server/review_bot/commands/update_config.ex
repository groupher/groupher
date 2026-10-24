defmodule GroupherServer.ReviewBot.Commands.UpdateConfig do
  @moduledoc """
  Updates one ReviewBot policy through the existing receipt-backed CommandPipeline.

      expected config version -> scoped permission -> one versioned config row

  Business position:

      ReviewBot settings mutation
        -> UpdateConfig CommandPipeline + Receipt
          -> scoped config authorization
            -> versioned ReviewBotConfig

  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo, ReviewBot}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias CMS.Command.ConfirmationDefinition
  alias ReviewBot.Model.ReviewBotConfig

  @pipeline operation: :review_bot_update_config,
            access: :user,
            target: :scope,
            params: [:subject_type, :expected_version, :attrs],
            confirmation: __MODULE__.Confirmation

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation containing the saved ReviewBot configuration identity.

    Business position:

        UpdateConfig CommandPipeline -> Receipt -> canonical policy config
    """

    use ConfirmationDefinition,
      operation: :review_bot_update_config,
      data_keys: ["config_id"],
      field_types: %{"config_id" => :string}
  end

  @doc "Updates one community policy if its expected version is current."
  @spec execute(map(), :article | :comment, pos_integer(), map(), User.t(), Ecto.UUID.t()) ::
          {:ok, ReviewBotConfig.t()} | {:error, term()}
  def execute(scope, subject_type, expected_version, attrs, %User{} = actor, command_id)
      when subject_type in [:article, :comment] and is_integer(expected_version) and is_map(attrs) do
    execute_pipeline(scope, subject_type, expected_version, attrs, actor, command_id)
  end

  def execute(_scope, _subject_type, _expected_version, _attrs, _actor, _command_id) do
    {:error, ReviewBot.ErrorCat.invalid_config()}
  end

  receipt_pipeline execute_pipeline(
                     scope,
                     subject_type,
                     expected_version,
                     attrs,
                     actor,
                     command_id
                   ) do
    prepare(fn -> prepare(scope, subject_type, expected_version, attrs) end)
    gate(fn prepared -> authorize(prepared, actor) end)

    change(fn prepared -> persist(prepared, actor) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(&present_result/1)
  end

  defp prepare(scope, subject_type, expected_version, attrs) do
    with {:ok, community_id, target, scope_key} <- normalize_scope(scope, subject_type) do
      {:ok,
       %{
         scope: scope,
         community_id: community_id,
         scope_key: scope_key,
         target: target,
         subject_type: subject_type,
         expected_version: expected_version,
         attrs: attrs
       },
       target: target,
       params: %{
         "scope" => scope_key,
         "subject_type" => Atom.to_string(subject_type),
         "expected_version" => expected_version,
         "attrs" => attrs
       }}
    end
  end

  defp authorize(%{scope: scope} = prepared, actor) do
    with {:ok, :pass} <- ReviewBot.Authorization.authorize(scope, :configure, actor) do
      {:ok, prepared}
    end
  end

  defp persist(prepared, actor) do
    with {:ok, attrs} <- validate_attrs(prepared.subject_type, prepared.attrs),
         %ReviewBotConfig{} = config <-
           locked_config(prepared.community_id, prepared.subject_type),
         {:ok, :pass} <- check_version(config, prepared.expected_version),
         {:ok, updated} <-
           config
           |> ReviewBotConfig.changeset(
             Map.merge(attrs, %{version: config.version + 1, updated_by_id: actor.id})
           )
           |> Repo.update() do
      {:ok, %Confirmation{data: %{"config_id" => updated.id}}}
    else
      nil -> {:error, ReviewBot.ErrorCat.config_not_found()}
      {:error, _reason} = error -> error
      _ -> {:error, ReviewBot.ErrorCat.invalid_config()}
    end
  end

  defp validate_attrs(subject_type, attrs) do
    allowed = [:review_mode, :ban_words, :prompt]

    with true <- Map.keys(attrs) -- allowed == [],
         true <- Map.has_key?(attrs, :review_mode),
         true <- Map.has_key?(attrs, :ban_words),
         true <- Map.has_key?(attrs, :prompt),
         true <- attrs.review_mode in [:immediate, :ai_first, :human_first],
         true <- is_list(attrs.ban_words) and Enum.all?(attrs.ban_words, &is_binary/1),
         true <- is_binary(attrs.prompt),
         true <- subject_type != :doc or attrs.review_mode == :immediate do
      {:ok, attrs}
    else
      _ -> {:error, ReviewBot.ErrorCat.invalid_config()}
    end
  end

  defp locked_config(community_id, subject_type) do
    ReviewBotConfig
    |> where(
      [config],
      config.community_id == ^community_id and config.subject_type == ^subject_type
    )
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp check_version(%ReviewBotConfig{version: version}, version), do: {:ok, :pass}

  defp check_version(_config, _expected_version) do
    {:error, ReviewBot.ErrorCat.config_version_conflict()}
  end

  defp normalize_scope(
         %{type: :community, community: %Community{id: id} = community},
         subject_type
       )
       when subject_type in [:article, :comment] do
    {:ok, id, community, "community:#{id}"}
  end

  defp normalize_scope(_scope, _subject_type) do
    {:error, ReviewBot.ErrorCat.invalid_config()}
  end

  defp present_result(%Confirmation{data: %{"config_id" => id}}) do
    ReviewBot.Config.config_by_id(id)
  end

  defp present_result(_result), do: {:error, ReviewBot.ErrorCat.invalid_config()}
end
