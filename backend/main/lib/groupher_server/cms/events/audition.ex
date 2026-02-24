defmodule GroupherServer.CMS.Events.Audition do
  @moduledoc """
  events for mention task

  parse and fmt(see shape function) mentions to Delivery module
  """
  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}

  alias CMS.Events.Event
  alias CMS.Model.Comment
  alias Helper.AuditBot

  @behaviour GroupherServer.CMS.Events.Handler

  @type audition_result :: {:ok, map()} | {:error, map()}
  @type handle_result :: {:ok, term()} | {:error, term()}

  @spec handle(Event.t()) :: handle_result()
  @impl true
  def handle(%Event{type: :audition, payload: %{artiment: artiment}}) do
    handle(artiment)
  end

  @spec handle(Comment.t() | map()) :: audition_result()
  def handle(%{body_html: body_html} = comment) do
    AuditBot.analysis(:text, body_html) |> handle_audition_result(comment)
  end

  @spec handle(map()) :: audition_result()
  def handle(%{title: title, document: _document} = article) do
    body_html = Repo.preload(article, :document) |> get_in([:document, :body_html])
    audit_text = title <> body_html

    AuditBot.analysis(:text, audit_text) |> handle_audition_result(article)
  end

  @spec handle_edge(Comment.t() | map()) :: audition_result()
  def handle_edge(%{body_html: body_html} = comment) do
    AuditBot.analysis_wrong(:text, body_html)
    |> handle_audition_result(comment)
  end

  @spec handle_edge(map()) :: audition_result()
  def handle_edge(%{title: title, document: _document} = article) do
    body_html = Repo.preload(article, :document) |> get_in([:document, :body_html])
    audit_text = title <> body_html

    AuditBot.analysis_wrong(:text, audit_text)
    |> handle_audition_result(article)
  end

  @spec handle_audition_result(audition_result(), Comment.t() | map()) :: audition_result()
  def handle_audition_result({:ok, audit_res}, %{body_html: _} = comment) do
    audit_res = Map.merge(audit_res, %{illegal_comments: []})
    CMS.Comments.unset_comment_illegal(comment.id, audit_res)
  end

  def handle_audition_result({:ok, audit_res}, article) do
    audit_res = Map.merge(audit_res, %{illegal_articles: []})
    CMS.Articles.unset_illegal(article, audit_res)
  end

  def handle_audition_result(
        {:error, %{audit_failed: true} = audit_res},
        %{body_html: _} = comment
      ) do
    CMS.Comments.set_comment_audit_failed(comment, audit_res)
  end

  def handle_audition_result({:error, %{audit_failed: true} = audit_res}, article) do
    CMS.Articles.set_audit_failed(article, audit_res)
  end

  def handle_audition_result({:error, audit_res}, %{body_html: _} = comment) do
    comment_addr = "/#{String.downcase(comment.thread)}/#{comment.id}"
    illegal_comments = [comment_addr]

    audit_res = Map.merge(audit_res, %{illegal_comments: illegal_comments})
    CMS.Comments.set_comment_illegal(comment.id, audit_res)
  end

  def handle_audition_result({:error, audit_res}, article) do
    article_addr = "/#{String.downcase(article.meta.thread)}/#{article.id}"
    illegal_articles = [article_addr]

    audit_res = Map.merge(audit_res, %{illegal_articles: illegal_articles})
    CMS.Articles.set_illegal(article, audit_res)
  end
end
