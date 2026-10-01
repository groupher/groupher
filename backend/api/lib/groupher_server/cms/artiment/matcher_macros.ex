defmodule GroupherServer.CMS.Artiment.MatcherMacros do
  @moduledoc """
  Generates the thread-specific clauses used by `CMS.Artiment.Matcher`.

  Business position:

      Client / importer
        -> GraphQL or service boundary
        -> CMS.Articles
        -> MatcherMacros
        -> Repo / domain event
  """

  alias GroupherServer.CMS

  alias CMS.Artiment.Config
  alias CMS.Model.Embeds

  @threads Config.threads()

  @doc """
  match basic threads

  {:ok, info} <- match(:post)
  Stable Article info:
  %{
    model: Article,
    thread: :post,
    foreign_key: article_id,
    preload: :article
    default_meta: ...
  }
  """
  defmacro thread_matches do
    @threads
    |> Enum.map(fn thread ->
      quote do
        @spec match(unquote(thread)) :: {:ok, GroupherServer.CMS.Artiment.Matcher.match_info()}
        def match(unquote(thread)) do
          {:ok,
           %{
             model: CMS.Model.Article,
             thread: unquote(thread),
             foreign_key: :article_id,
             preload: :article,
             default_meta: Embeds.ArticleMeta.default_meta()
           }}
        end
      end
    end)
  end

  @doc """
  match basic thread query

  {:ok, info} <- match(:post, :query, id)
  info:
  %{dynamic([c], field(c, :article_id) == ^id)}
  """
  defmacro thread_query_matches do
    @threads
    |> Enum.map(fn thread ->
      quote do
        def match(unquote(thread), :query, id) do
          {:ok, dynamic([c], c.article_id == ^id and c.thread == unquote(thread))}
        end
      end
    end)
  end
end
