defmodule GroupherServer.CMS.Model.AbuseReport do
  @moduledoc """
  Ecto schema for user-submitted abuse reports.

  Report records connect a reporter, source content, and moderation case payload
  so audit/review workflows can process unsafe content independently of the
  source article or comment table.

  Business position:

      CMS context
        -> AbuseReport schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  alias __MODULE__
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Article, Comment, Community, DocBranch, Embeds}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  # @required_fields ~w(comment_id user_id received_user_id)a
  @optional_fields ~w(comment_id account_id operate_user_id deal_with report_cases_count)a
  @update_fields ~w(operate_user_id deal_with report_cases_count)a

  @type t :: %AbuseReport{}
  schema "abuse_reports" do
    belongs_to(:comment, Comment, foreign_key: :comment_id)
    belongs_to(:account, User, foreign_key: :account_id)
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:community, Community)
    belongs_to(:branch, DocBranch)

    embeds_many(:report_cases, Embeds.AbuseReportCase, on_replace: :delete)
    field(:report_cases_count, :integer, default: 0)

    belongs_to(:operate_user, User, foreign_key: :operate_user_id)

    field(:deal_with, :string)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%AbuseReport{} = struct, attrs) do
    struct
    |> cast(attrs, [:article_id, :community_id, :branch_id] ++ @optional_fields)
    |> cast_embed(:report_cases, required: true, with: &Embeds.AbuseReportCase.changeset/2)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
  end

  def update_changeset(%AbuseReport{} = struct, attrs) do
    struct
    |> cast(attrs, [:article_id, :community_id, :branch_id] ++ @update_fields)
    |> cast_embed(:report_cases, required: true, with: &Embeds.AbuseReportCase.changeset/2)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
  end
end
