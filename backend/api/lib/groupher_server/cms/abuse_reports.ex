defmodule GroupherServer.CMS.AbuseReports do
  @moduledoc """
  Public CMS boundary for filing, undoing, and listing abuse reports.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> AbuseReports
        -> Repo / external boundary
  """

  alias __MODULE__.{Query, Report}
  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.Comment
  alias Helper.T

  @doc "Returns paged reports from the `AbuseReports` read boundary."
  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(filter), do: Query.paged_reports(filter)

  @doc "Runs `account` through the public `AbuseReports` boundary."
  @spec account(User.t(), String.t(), map(), User.t()) :: T.domain_res(User.t())
  def account(%User{} = target_account, reason, attr, %User{} = user) do
    Report.account(target_account, reason, attr, user)
  end

  @doc "Runs `undo_account` through the public `AbuseReports` boundary."
  @spec undo_account(User.t(), User.t()) :: T.domain_res(User.t())
  def undo_account(%User{} = target_account, %User{} = user) do
    Report.undo_account(target_account, user)
  end

  @doc "Runs `article` through the public `AbuseReports` boundary."
  @spec article(T.article(), String.t(), map(), User.t()) :: T.domain_res(T.article())
  def article(target_article, reason, attr, %User{} = user) do
    CMS.Interactions.report(target_article, reason, attr, user)
  end

  @doc "Runs `undo_article` through the public `AbuseReports` boundary."
  @spec undo_article(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_article(target_article, %User{} = user) do
    CMS.Interactions.undo_report(target_article, user)
  end

  @doc "Runs `comment` through the public `AbuseReports` boundary."
  @spec comment(Comment.t(), String.t(), map(), User.t()) :: T.domain_res(Comment.t())
  def comment(%Comment{} = target_comment, reason, attr, %User{} = user) do
    CMS.Interactions.report(target_comment, reason, attr, user)
  end

  @doc "Runs `undo_comment` through the public `AbuseReports` boundary."
  @spec undo_comment(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def undo_comment(%Comment{} = target_comment, %User{} = user) do
    CMS.Interactions.undo_report(target_comment, user)
  end
end
