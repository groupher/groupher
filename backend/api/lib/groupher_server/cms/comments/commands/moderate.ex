defmodule GroupherServer.CMS.Comments.Commands.Moderate do
  @moduledoc """
  Resolves a canonical Comment once before moderation writes.

      Comment command -> canonical Comment -> moderation write
  """

  alias GroupherServer.CMS
  alias CMS.Comments.Moderation
  alias CMS.FrontDesk
  alias CMS.Model.Comment

  @spec execute(atom(), term(), map()) :: {:ok, term()} | {:error, term()}
  def execute(:set_illegal, comment_id, attrs) do
    with {:ok, %Comment{} = comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      Moderation.set_illegal(comment, attrs)
    end
  end

  def execute(:unset_illegal, comment_id, attrs) do
    with {:ok, %Comment{} = comment} <- FrontDesk.comment(comment_id, mode: :internal) do
      Moderation.unset_illegal(comment, attrs)
    end
  end

  def execute(:set_audit_failed, %Comment{} = comment, state) do
    Moderation.set_audit_failed(comment, state)
  end
end
