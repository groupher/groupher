defmodule GroupherServer.CMS.AbuseReports do
  @moduledoc """
  Public CMS boundary for filing, undoing, and listing abuse reports.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> AbuseReports
        -> Repo / external boundary
  """

  alias GroupherServer.CMS

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Comment
  alias Helper.T

  alias __MODULE__.{List, Report}

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  @doc "Returns paged reports from the `AbuseReports` read boundary."
  def paged_reports(filter), do: List.paged_reports(filter)

  @spec account(User.t(), String.t(), map(), User.t()) :: T.domain_res(User.t())
  @doc "Runs `account` through the public `AbuseReports` boundary."
  def account(%User{} = target_account, reason, attr, %User{} = user) do
    Report.account(target_account, reason, attr, user)
  end

  @spec undo_account(User.t(), User.t()) :: T.domain_res(User.t())
  @doc "Runs `undo_account` through the public `AbuseReports` boundary."
  def undo_account(%User{} = target_account, %User{} = user) do
    Report.undo_account(target_account, user)
  end

  @spec article(T.article(), String.t(), map(), User.t()) :: T.domain_res(T.article())
  @doc "Runs `article` through the public `AbuseReports` boundary."
  def article(target_article, reason, attr, %User{} = user) do
    CMS.Interactions.report(target_article, reason, attr, user)
  end

  @spec undo_article(T.article(), User.t()) :: T.domain_res(T.article())
  @doc "Runs `undo_article` through the public `AbuseReports` boundary."
  def undo_article(target_article, %User{} = user) do
    CMS.Interactions.undo_report(target_article, user)
  end

  @spec comment(Comment.t(), String.t(), map(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `comment` through the public `AbuseReports` boundary."
  def comment(%Comment{} = target_comment, reason, attr, %User{} = user) do
    CMS.Interactions.report(target_comment, reason, attr, user)
  end

  @spec undo_comment(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  @doc "Runs `undo_comment` through the public `AbuseReports` boundary."
  def undo_comment(%Comment{} = target_comment, %User{} = user) do
    CMS.Interactions.undo_report(target_comment, user)
  end
end
