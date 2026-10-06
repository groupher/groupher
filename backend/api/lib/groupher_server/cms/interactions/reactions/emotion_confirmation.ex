defmodule GroupherServer.CMS.Interactions.Reactions.EmotionConfirmation do
  @moduledoc """
  Confirms either variant of the shared emotion set-state command.

      emotion add/remove -> encode with variant tag -> Receipt -> decode
  """

  use GroupherServer.CMS.Command.ConfirmationDefinition,
    operation: :emotion_add,
    operations: [:emotion_add, :emotion_remove],
    data_keys: ["emotion", "operation", "outcome", "target_id", "target_type"],
    field_types: %{
      "emotion" => :string,
      "operation" => :string,
      "outcome" => :string,
      "target_id" => :string,
      "target_type" => :string
    },
    variant_key: "operation"
end
