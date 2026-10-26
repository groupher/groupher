defmodule GroupherServer.ReviewBot.Model.ReviewBotConfig do
  @moduledoc """
  System or community policy used by ReviewBot for one content type.

      authorized ReviewBot command -> versioned config row -> immutable CMS request snapshot
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.review_bot()
  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @subject_types [:article, :comment, :doc]
  @review_modes [:immediate, :ai_first, :human_first]

  @type t :: %__MODULE__{}

  schema "review_bot_configs" do
    belongs_to(:community, Community)
    field(:subject_type, Ecto.Enum, values: @subject_types)
    field(:review_mode, Ecto.Enum, values: @review_modes)
    field(:ban_words, {:array, :string}, default: [])
    field(:prompt, :string, default: "")
    field(:version, :integer, default: 1)
    belongs_to(:updated_by, User)
    timestamps(type: :utc_datetime)
  end

  @doc "Validates one complete system or community ReviewBot policy."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(config, attrs) do
    config
    |> cast(
      attrs,
      [:community_id, :subject_type, :review_mode, :ban_words, :prompt, :version, :updated_by_id],
      empty_values: []
    )
    |> validate_required([:subject_type, :ban_words, :version])
    |> validate_review_mode()
    |> validate_number(:version, greater_than: 0)
    |> validate_length(:prompt, max: 8_000)
    |> update_change(:ban_words, fn values ->
      values
      |> Enum.map(&String.trim/1)
      |> Enum.reject(&(&1 == ""))
      |> Enum.uniq()
    end)
    |> validate_ban_words()
    |> validate_prompt()
    |> validate_doc_scope()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:updated_by_id)
    |> unique_constraint(:subject_type, name: :review_bot_configs_system_subject_unique)
    |> unique_constraint([:community_id, :subject_type],
      name: :review_bot_configs_community_subject_unique
    )
  end

  defp validate_ban_words(changeset) do
    validate_change(changeset, :ban_words, fn :ban_words, values ->
      cond do
        length(values) > 10_000 ->
          [ban_words: "contains too many entries"]

        not Enum.all?(values, &(is_binary(&1) and &1 != "" and String.length(&1) <= 128)) ->
          [ban_words: "contains an invalid entry"]

        true ->
          []
      end
    end)
  end

  defp validate_doc_scope(changeset) do
    cond do
      get_field(changeset, :subject_type) != :doc ->
        changeset

      not is_nil(get_field(changeset, :community_id)) ->
        add_error(changeset, :community_id, "Doc policies are platform-only")

      not is_nil(get_field(changeset, :review_mode)) ->
        add_error(changeset, :review_mode, "System policies do not have a review mode")

      true ->
        changeset
    end
  end

  defp validate_review_mode(changeset) do
    case get_field(changeset, :community_id) do
      nil ->
        if is_nil(get_field(changeset, :review_mode)) do
          changeset
        else
          add_error(changeset, :review_mode, "System policies do not have a review mode")
        end

      _community_id ->
        if get_field(changeset, :review_mode) in @review_modes do
          changeset
        else
          add_error(changeset, :review_mode, "is required for community policies")
        end
    end
  end

  defp validate_prompt(changeset) do
    prompt = get_field(changeset, :prompt)
    community_id = get_field(changeset, :community_id)

    if is_binary(prompt) and (not is_nil(community_id) or String.trim(prompt) != "") do
      changeset
    else
      add_error(changeset, :prompt, "is required for the platform policy")
    end
  end
end
