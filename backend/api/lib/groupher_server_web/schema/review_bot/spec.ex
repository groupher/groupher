defmodule GroupherServerWeb.Schema.ReviewBot.Spec do
  @moduledoc """
  GraphQL types for ReviewBot configuration and policy input.

  Business position:

      ReviewBot configuration resolver
        -> scope, mode and config GraphQL types
          -> client contract
  """

  use Helper.GqlSchemaSuite

  enum :review_bot_scope_type do
    @desc "Selects platform-wide scope for alert queries."
    value(:platform)
    @desc "Applies the policy for one community."
    value(:community)
  end

  enum :review_bot_subject_type do
    @desc "Reviews article content."
    value(:article)
    @desc "Reviews comments and replies."
    value(:comment)
  end

  enum :review_bot_mode do
    @desc "Allows publication before review results arrive."
    value(:immediate)
    @desc "Holds publication pending automated review."
    value(:ai_first)
    @desc "Requires human approval for initial publication."
    value(:human_first)
  end

  input_object :review_bot_scope_input do
    @desc "Selects the platform or community policy."
    field(:type, non_null(:review_bot_scope_type))
    @desc "Identifies the community when selecting community scope."
    field(:community, :string)
  end

  object :review_bot_config do
    @desc "Identifies this review configuration."
    field(:id, non_null(:id))
    @desc "Identifies the community that owns this policy, or is null for platform policy."
    field(:community_id, :id)
    @desc "Identifies the kind of content governed by this policy."
    field(:subject_type, non_null(:review_bot_subject_type))
    @desc "Determines when reviewed content becomes visible."
    field(:review_mode, non_null(:review_bot_mode))

    @desc "Lists the terms configured for content screening."
    field(:review_ban_words, non_null(list_of(non_null(:string))),
      resolve: fn config, _, _ -> {:ok, config.ban_words} end
    )

    @desc "Provides the instructions configured for automated review."
    field(:review_prompt, non_null(:string), resolve: fn config, _, _ -> {:ok, config.prompt} end)
    @desc "Identifies the current revision for subsequent updates."
    field(:version, non_null(:integer))
    @desc "Records when the configuration last changed."
    field(:updated_at, non_null(:datetime))
  end

  input_object :update_review_bot_config_input do
    @desc "Selects the policy scope to update."
    field(:scope, non_null(:review_bot_scope_input))
    @desc "Selects the content category to configure."
    field(:subject_type, non_null(:review_bot_subject_type))
    @desc "Rejects the update if the stored version differs from this value."
    field(:expected_version, non_null(:integer))
    @desc "Sets when reviewed content may become visible."
    field(:review_mode, non_null(:review_bot_mode))
    @desc "Replaces the terms used for content screening."
    field(:review_ban_words, non_null(list_of(non_null(:string))))
    @desc "Replaces the instructions for automated review."
    field(:review_prompt, non_null(:string))
  end
end
