defmodule GroupherServerWeb.Schema.ReviewBot.Types do
  @moduledoc """
  GraphQL types for ReviewBot configuration and policy input.

  Business position:

      ReviewBot configuration resolver
        -> scope, mode and config GraphQL types
          -> client contract
  """

  use Helper.GqlSchemaSuite

  enum :review_bot_scope_type do
    value(:platform)
    value(:community)
  end

  enum :review_bot_subject_type do
    value(:article)
    value(:comment)
    value(:doc)
  end

  enum :review_bot_mode do
    value(:immediate)
    value(:ai_first)
    value(:human_first)
  end

  input_object :review_bot_scope_input do
    field(:type, non_null(:review_bot_scope_type))
    field(:community, :string)
  end

  object :review_bot_config do
    field(:id, non_null(:id))
    field(:community_id, :id)
    field(:subject_type, non_null(:review_bot_subject_type))
    field(:review_mode, non_null(:review_bot_mode))

    field(:review_ban_words, non_null(list_of(non_null(:string))),
      resolve: fn config, _, _ -> {:ok, config.ban_words} end
    )

    field(:review_prompt, non_null(:string), resolve: fn config, _, _ -> {:ok, config.prompt} end)
    field(:version, non_null(:integer))
    field(:updated_at, non_null(:datetime))
  end

  input_object :update_review_bot_config_input do
    field(:scope, non_null(:review_bot_scope_input))
    field(:subject_type, non_null(:review_bot_subject_type))
    field(:expected_version, non_null(:integer))
    field(:review_mode, non_null(:review_bot_mode))
    field(:review_ban_words, non_null(list_of(non_null(:string))))
    field(:review_prompt, non_null(:string))
  end
end
