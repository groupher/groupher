defmodule GroupherServerWeb.Schema.AlertWall.Spec do
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
    @desc "The alert is awaiting resolution."
    value(:open)
    @desc "A resolution has been recorded for the alert."
    value(:resolved)
    @desc "A newer alert has superseded this item."
    value(:superseded)
  end

  enum :alert_target_type do
    @desc "Identifies a reported article."
    value(:article)
    @desc "Identifies a reported comment."
    value(:comment)
    @desc "Identifies a reported user account."
    value(:user)
  end

  enum :alert_item_owner do
    @desc "Routes the item to content moderation."
    value(:cms)
    @desc "Routes the item to account moderation."
    value(:accounts)
  end

  enum :alert_report_reason do
    @desc "Reports unsolicited or repetitive content."
    value(:spam)
    @desc "Reports abusive conduct targeting someone."
    value(:harassment)
    @desc "Reports content alleged to be illegal."
    value(:illegal_content)
    @desc "Reports someone posing as another person."
    value(:impersonation)
    @desc "Reports a concern outside the listed categories."
    value(:other)
  end

  enum :alert_report_status do
    @desc "The report still applies to its target."
    value(:active)
    @desc "The reporter has withdrawn the report."
    value(:withdrawn)
    @desc "The report concerns an earlier version of the target."
    value(:outdated)
    @desc "A resolution has been recorded for the report."
    value(:resolved)
  end

  input_object :alert_item_filter do
    @desc "Limits items to the specified kind of target."
    field(:target_type, :alert_target_type)
    @desc "Limits items to the specified moderation owner."
    field(:owner, :alert_item_owner)
    @desc "Filters items by whether they have reports."
    field(:has_reports, :boolean)
    @desc "Filters items by whether they are closed."
    field(:closed, :boolean)
  end

  input_object :alert_report_filter do
    @desc "Limits reports to the specified kind of target."
    field(:target_type, :alert_target_type)
    @desc "Limits reports to the selected state."
    field(:status, :alert_report_status)
  end

  input_object :alert_report_target_input do
    @desc "Selects the kind of target being reported."
    field(:type, non_null(:alert_target_type))
    @desc "Identifies the content revision seen by the reporter."
    field(:observed_version, :integer)
    @desc "Locates the article for an article report."
    field(:article, :article_path_input)
    @desc "Locates the comment for a comment report."
    field(:comment, :comment_path_input)
    @desc "Identifies the reported account by login."
    field(:user_login, :string)
  end

  input_object :alert_report_input do
    @desc "Identifies the subject of the report."
    field(:target, non_null(:alert_report_target_input))
    @desc "Classifies the reason for reporting the target."
    field(:report_type, non_null(:alert_report_reason))
    @desc "Provides additional context from the reporter."
    field(:details, :string)
  end

  object :sus_note do
    @desc "Classifies the suspected issue."
    field(:type, non_null(:string), resolve: &R.AlertWall.sus_note_field/3)
    @desc "Contains the evidence cited for this concern."
    field(:evidence, non_null(:string), resolve: &R.AlertWall.sus_note_field/3)
    @desc "Explains why the evidence raised a concern."
    field(:explanation, non_null(:string), resolve: &R.AlertWall.sus_note_field/3)
  end

  object :alert_item do
    @desc "Identifies the moderation item."
    field(:id, non_null(:id))
    @desc "Identifies the domain responsible for the item."
    field(:owner, non_null(:alert_item_owner))
    @desc "Identifies the kind of subject under review."
    field(:target_type, non_null(:alert_target_type))
    @desc "Identifies the subject, using its login for user accounts."
    field(:target_id, :string, resolve: &R.AlertWall.public_target_id/3)
    @desc "Identifies the community associated with the item, when applicable."
    field(:community_id, :id)
    @desc "References the automated review that raised the concern."
    field(:ai_source_ref, :string)
    @desc "Indicates whether the item is open, resolved or superseded."
    field(:status, non_null(:alert_item_status))
    @desc "Lists the concerns recorded during automated review."
    field(:sus_notes, non_null(list_of(non_null(:sus_note))))
    @desc "Summarizes the issue for reviewers."
    field(:summary, non_null(:string))
    @desc "Counts active reports linked to the item."
    field(:report_count, non_null(:integer), resolve: &R.AlertWall.report_count/3)
    @desc "Counts all reports linked to the item, including inactive reports."
    field(:total_report_count, non_null(:integer), resolve: &R.AlertWall.total_report_count/3)
    @desc "Identifies the item revision used for conditional resolution."
    field(:version, non_null(:integer))
    @desc "Records when the item was opened."
    field(:opened_at, non_null(:datetime))
    @desc "Records when the item was resolved."
    field(:resolved_at, :datetime)
    @desc "Contains the resolution recorded for the item."
    field(:resolution, :string)
  end

  object :alert_report do
    @desc "Identifies the submitted report."
    field(:id, non_null(:id))
    @desc "Identifies the reporter by login when available."
    field(:reporter_login, :string, resolve: &R.AlertWall.reporter_login/3)
    @desc "Identifies the kind of subject reported."
    field(:target_type, non_null(:alert_target_type))
    @desc "Identifies the reported subject, using its login for user accounts."
    field(:target_id, :string, resolve: &R.AlertWall.public_target_id/3)
    @desc "Identifies the community associated with the report, when applicable."
    field(:community_id, :id)
    @desc "Identifies the moderation item that groups this report."
    field(:item_id, non_null(:id))
    @desc "Identifies the content revision observed by the reporter."
    field(:observed_version, :integer)
    @desc "Classifies the reason given by the reporter."
    field(:report_type, non_null(:string))
    @desc "Contains additional context supplied by the reporter."
    field(:details, :string)
    @desc "Records when the reporter withdrew the report."
    field(:withdrawn_at, :datetime)
    @desc "Records when the report became outdated."
    field(:outdated_at, :datetime)
    @desc "Records when the report was resolved."
    field(:resolved_at, :datetime)
    @desc "Contains the outcome recorded for the report."
    field(:resolution, :string)
    @desc "Records when the report was submitted."
    field(:inserted_at, non_null(:datetime))
  end

  object :alert_item_page do
    @desc "Lists the moderation items on this page."
    field(:entries, non_null(list_of(non_null(:alert_item))))
    pagi_fields()
  end

  object :alert_report_page do
    @desc "Lists the reports on this page."
    field(:entries, non_null(list_of(non_null(:alert_report))))
    pagi_fields()
  end
end
