defmodule GroupherServer.CMS.Articles.EditingPolicy do
  @moduledoc """
  Loads the locked facts for published Article content editing admission.

  The caller holds the Article admission transaction and its aggregate lock.
  Community creation guarantees a Dashboard row; a missing row is an invariant
  violation and fails closed.

      Gate context -> locked Public and bindings -> Dashboard policy -> effective fact
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias CMS.Gate.Context.Access.Article, as: ArticleContext
  alias CMS.Gate.ErrorCat
  alias CMS.Model.{ArticleBinding, ArticlePublic, CommunityDashboard}

  @fields %{
    post: :post_published_editing,
    blog: :blog_published_editing,
    changelog: :changelog_published_editing
  }

  @doc "Adds the locked effective policy fact only for a content-editing admission."
  def load(%ArticleContext{article: %{thread: thread}} = context, :edit_article)
      when thread in [:post, :blog, :changelog] do
    article = context.article

    bindings =
      Repo.all(
        from(binding in ArticleBinding,
          where: binding.article_id == ^article.id,
          order_by: binding.community_id,
          lock: "FOR SHARE"
        )
      )

    if Repo.exists?(from(public in ArticlePublic, where: public.article_id == ^article.id)) do
      ids = bindings |> Enum.map(& &1.community_id) |> Enum.uniq() |> Enum.sort()

      dashboards =
        Repo.all(
          from(dashboard in CommunityDashboard,
            where: dashboard.community_id in ^ids,
            order_by: dashboard.community_id,
            lock: "FOR SHARE"
          )
        )

      if length(dashboards) == length(ids) do
        field = Map.fetch!(@fields, article.thread)
        values = Enum.map(dashboards, fn dashboard -> Map.get(dashboard.enable || %{}, field) end)
        default = Application.get_env(:groupher_server, :published_article_editing_default, true)
        {:ok, %{context | published_article_editable?: allowed?(values, default)}}
      else
        {:ok,
         %{
           context
           | published_article_editable?: nil,
             published_article_editing_error: ErrorCat.dashboard_not_found()
         }}
      end
    else
      {:ok, %{context | published_article_editable?: true}}
    end
  end

  def load(context, _action), do: {:ok, context}

  defp allowed?(values, default) do
    cond do
      Enum.any?(values, &(&1 == false)) -> false
      Enum.any?(values, &(&1 == true)) -> true
      true -> default == true
    end
  end
end
