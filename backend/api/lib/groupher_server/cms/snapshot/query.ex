defmodule GroupherServer.CMS.Snapshot.Query do
  @moduledoc """
  Loads authoritative display summaries for snapshot refreshes.

      Snapshot.Projection / Snapshot.Refresh
        -> Snapshot.Query
        -> Gate scope / Repo

  Query owns visibility-safe database reads and unavailable placeholders. It
  does not decide cache mode or mutate binding membership.
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Artiment.Matcher
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Model.{ArticleBinding, Comment, CommentLifecycle}

  @doc "Loads summaries for one snapshot kind and returns them keyed by id."
  @spec load_summaries(:user | :article | :comment, atom() | nil, [term()]) :: map()
  def load_summaries(_kind, _thread, []), do: %{}

  def load_summaries(:user, _thread, ids) do
    User
    |> where([user], user.id in ^ids)
    |> Repo.all()
    |> Map.new(&{&1.id, user_summary(&1)})
    |> with_unavailable(ids, &unavailable_user/1)
  end

  def load_summaries(:article, thread, ids) do
    case Matcher.match(thread) do
      {:ok, %{model: model}} ->
        model
        |> CMS.Gate.scope(nil, :list, scope_context(thread))
        |> join(:inner, [article], binding in ArticleBinding,
          on: binding.article_id == article.id
        )
        |> where([article], article.id in ^ids)
        |> select([article, binding, ...], %{
          id: article.id,
          inner_id: binding.inner_id,
          title: as(:gate_article_public).title,
          slug: as(:gate_article_public).slug,
          thread: article.thread,
          updated_at: as(:gate_article_public).updated_at
        })
        |> Repo.all()
        |> Map.new(&{&1.id, article_summary(thread, &1)})
        |> with_unavailable(ids, &unavailable_article(thread, &1))

      _ ->
        %{}
    end
  end

  def load_summaries(:comment, thread, ids) do
    Comment
    |> join(:inner, [comment], lifecycle in CommentLifecycle,
      on: lifecycle.comment_id == comment.id
    )
    |> where([comment], comment.thread == ^thread and comment.id in ^ids)
    |> select([comment, lifecycle], {comment, lifecycle.state})
    |> Repo.all()
    |> Map.new(fn {comment, state} -> {comment.id, comment_summary(thread, comment, state)} end)
    |> with_unavailable(ids, &unavailable_comment(thread, &1))
  end

  defp with_unavailable(summary_by_id, ids, fallback_fun) do
    Enum.reduce(ids, summary_by_id, fn id, acc -> Map.put_new(acc, id, fallback_fun.(id)) end)
  end

  defp user_summary(%User{} = user) do
    %{
      id: user.id,
      user_id: user.id,
      login: user.login,
      nickname: user.nickname || user.login,
      avatar: user.avatar,
      bio: user.bio,
      shortbio: user.shortbio,
      updated_at: user.updated_at
    }
  end

  defp article_summary(thread, article) do
    %{
      id: article.id,
      inner_id: Map.get(article, :inner_id),
      title: article.title,
      slug: Map.get(article, :slug),
      thread: thread,
      updated_at: article.updated_at
    }
  end

  defp comment_summary(thread, %Comment{} = comment, :deleted) do
    thread |> unavailable_comment(comment.id) |> Map.put(:body_digest, Comment.delete_hint())
  end

  defp comment_summary(thread, %Comment{} = comment, _state) do
    %{
      id: comment.id,
      body_digest: digest(comment.body),
      article_id: comment.article_id,
      thread: thread,
      updated_at: comment.updated_at
    }
  end

  defp unavailable_user(id) do
    %{
      id: id,
      user_id: id,
      login: "deleted",
      nickname: "Deleted user",
      avatar: nil,
      unavailable: true
    }
  end

  defp unavailable_article(thread, id) do
    %{id: id, title: "Unavailable article", thread: thread, unavailable: true}
  end

  defp unavailable_comment(thread, id) do
    %{id: id, body_digest: "Unavailable comment", thread: thread, unavailable: true}
  end

  defp digest(nil), do: nil

  defp digest(body) do
    if(String.length(body) <= 120, do: body, else: String.slice(body, 0, 120))
  end

  defp scope_context(:doc), do: DocContext.public_main()
  defp scope_context(thread), do: ArticleContext.public(thread)
end
