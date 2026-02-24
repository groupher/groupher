defmodule GroupherServer.CMS.AbuseReports do
  @moduledoc """
  CMS abuse reports facade.
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Comment
  alias Helper.Types, as: T

  alias __MODULE__.{List, Report}

  @spec paged_reports(map()) :: T.domain_res(T.paged_data())
  def paged_reports(filter), do: List.paged_reports(filter)

  @spec account(User.t(), String.t(), map(), User.t()) :: T.domain_res(User.t())
  def account(%User{} = target_account, reason, attr, %User{} = user) do
    Report.account(target_account, reason, attr, user)
  end

  @spec undo_account(User.t(), User.t()) :: T.domain_res(User.t())
  def undo_account(%User{} = target_account, %User{} = user) do
    Report.undo_account(target_account, user)
  end

  @spec article(T.article(), String.t(), map(), User.t()) :: T.domain_res(T.article())
  def article(target_article, reason, attr, %User{} = user) do
    Report.article(target_article, reason, attr, user)
  end

  @spec undo_article(T.article(), User.t()) :: T.domain_res(T.article())
  def undo_article(target_article, %User{} = user) do
    Report.undo_article(target_article, user)
  end

  @spec comment(Comment.t(), String.t(), map(), User.t()) :: T.domain_res(Comment.t())
  def comment(%Comment{} = target_comment, reason, attr, %User{} = user) do
    Report.comment(target_comment, reason, attr, user)
  end

  @spec undo_comment(Comment.t(), User.t()) :: T.domain_res(Comment.t())
  def undo_comment(%Comment{} = target_comment, %User{} = user) do
    Report.undo_comment(target_comment, user)
  end
end
