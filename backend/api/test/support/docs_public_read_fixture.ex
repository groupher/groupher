defmodule GroupherServer.Test.DocsPublicReadFixture do
  @moduledoc """
  Prepares two public Docs with peer bindings in two Communities for read-scope tests.

      real seed publications in X -> same Article bindings in Y -> no public Y pages

  The extra bindings are test data, not evidence that Doc mirror commands have
  completed their migration. The caller owns the SQL Sandbox transaction.
  """

  alias GroupherServer.{CMS, Repo, Support}
  alias CMS.Articles.Numbering
  alias CMS.Model.ArticleBinding

  @doc "Builds two published Docs in X and numbered peer bindings without public pages in Y."
  def two_sites(opts \\ []) do
    {x, first, _, actor} = Support.Factory.mock_article(:doc)
    {_, second, _, _} = Support.Factory.mock_article(:doc, x, actor)
    {:ok, y} = Support.Factory.mock_community(actor)
    docs = [first, second]
    base = %{x: x, y: y, actor: actor, docs: docs}
    before_bind = Keyword.get(opts, :before_bind, fn _fixture -> {:ok, %{}} end)

    with {:ok, extra} <- before_bind.(base),
         {:ok, y_bindings} <- bind_all(docs, y) do
      x_bindings =
        Enum.map(docs, fn doc ->
          Repo.get_by!(ArticleBinding, article_id: doc.id, community_id: x.id)
        end)

      {:ok,
       base |> Map.merge(extra) |> Map.merge(%{x_bindings: x_bindings, y_bindings: y_bindings})}
    end
  end

  defp bind_all(docs, community) do
    Enum.reduce_while(docs, {:ok, []}, fn doc, {:ok, bindings} ->
      with {:ok, binding} <-
             %ArticleBinding{}
             |> ArticleBinding.changeset(%{
               article_id: doc.id,
               community_id: community.id,
               thread: :doc
             })
             |> Repo.insert(),
           {:ok, binding} <- Numbering.assign_binding_inner_id(binding) do
        {:cont, {:ok, bindings ++ [binding]}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end
end
