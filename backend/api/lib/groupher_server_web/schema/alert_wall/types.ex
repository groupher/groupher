defmodule GroupherServerWeb.Schema.AlertWall.Types do
  @moduledoc """
  GraphQL item and report types owned by AlertWall.

  Business position:

      AlertWall resolver values
        -> GraphQL item/report/action types
          -> client response
  """

  use Helper.GqlSchemaSuite
  import GroupherServerWeb.Schema.Helper.Fields, only: [pagi_fields: 0]

  enum :alert_item_status do
    value(:open)
    value(:resolved)
    value(:superseded)
  end

  enum :alert_target_type do
    value(:article)
    value(:comment)
    value(:doc)
    value(:user)
  end

  enum :alert_item_owner do
    value(:cms)
    value(:accounts)
  end

  enum :alert_report_reason do
    value(:spam)
    value(:harassment)
    value(:illegal_content)
    value(:impersonation)
    value(:other)
  end

  enum :alert_report_status do
    value(:active)
    value(:withdrawn)
    value(:outdated)
    value(:resolved)
  end

  input_object :alert_item_filter do
    field(:target_type, :alert_target_type)
    field(:owner, :alert_item_owner)
    field(:has_reports, :boolean)
  end

  input_object :alert_report_filter do
    field(:target_type, :alert_target_type)
    field(:status, :alert_report_status)
  end

  input_object :alert_report_target_input do
    field(:type, non_null(:alert_target_type))
    field(:article, :article_path_input)
    field(:comment, :comment_path_input)
    field(:doc_branch_id, :integer)
    field(:user_id, :id)
  end

  input_object :alert_report_input do
    field(:target, non_null(:alert_report_target_input))
    field(:report_type, non_null(:alert_report_reason))
    field(:details, :string)
  end

  object :sus_note do
    field(:type, non_null(:string))
    field(:evidence, non_null(:string))
    field(:explanation, non_null(:string))
  end

  object :alert_item do
    field(:id, non_null(:id))
    field(:owner, non_null(:alert_item_owner))
    field(:target_type, non_null(:alert_target_type))
    field(:target_id, non_null(:string))
    field(:community_id, :id)
    field(:status, non_null(:alert_item_status))
    field(:sus_notes, non_null(list_of(non_null(:sus_note))))
    field(:summary, non_null(:string))
    field(:report_count, non_null(:integer), resolve: &R.AlertWall.report_count/3)
    field(:version, non_null(:integer))
    field(:opened_at, non_null(:datetime))
    field(:resolved_at, :datetime)
    field(:resolution, :string)
  end

  object :alert_report do
    field(:id, non_null(:id))
    field(:target_type, non_null(:alert_target_type))
    field(:target_id, non_null(:string))
    field(:community_id, :id)
    field(:item_id, non_null(:id))
    field(:report_type, non_null(:string))
    field(:details, :string)
    field(:withdrawn_at, :datetime)
    field(:outdated_at, :datetime)
    field(:resolved_at, :datetime)
    field(:resolution, :string)
    field(:inserted_at, non_null(:datetime))
  end

  object :alert_item_page do
    field(:entries, non_null(list_of(non_null(:alert_item))))
    pagi_fields()
  end

  object :alert_report_page do
    field(:entries, non_null(list_of(non_null(:alert_report))))
    pagi_fields()
  end
end
