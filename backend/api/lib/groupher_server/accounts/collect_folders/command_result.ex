defmodule GroupherServer.Accounts.CollectFolders.CommandResult do
  @moduledoc """
  Builds the Accounts-owned result of a collect-folder membership command.

      CollectFolders write result + canonical Article
        -> ArticleStats + private Interaction state
        -> stable collect mutation result

  Public and private projections retain the independent revisions observed by
  their owners after commit or receipt recovery.
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User

  @doc "Builds one collect mutation result through shared projection readers."
  @spec build({:ok, map()} | {:error, term()}, struct(), User.t()) ::
          {:ok, map()} | {:error, term()}
  def build({:ok, result}, article, %User{} = viewer) do
    with {:ok, article_stats} <-
           CMS.ArticleStats.for_article(article, Map.get(article, :community)),
         interaction when is_map(interaction) <- CMS.Interactions.viewer_state(article, viewer) do
      {:ok,
       %{
         command_id: result.command_id,
         folder: result.folder,
         article_stats: article_stats,
         interaction_state: CMS.Interactions.ReadState.article_state(article_stats, interaction)
       }}
    end
  end

  def build({:error, _reason} = error, _article, %User{}), do: error
end
