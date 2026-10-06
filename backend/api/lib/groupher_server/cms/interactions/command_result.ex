defmodule GroupherServer.CMS.Interactions.CommandResult do
  @moduledoc """
  Builds the stable result of an Interaction command after commit or receipt
  recovery.

      Reactions command result
        -> ArticleStats + private ReadState
        -> stable Article reaction result

  Comment reactions reuse the Comment-owned response projection. ArticleStats
  and private Interaction state retain their independently observed revisions.
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Comments.InteractionResponse
  alias CMS.ErrorCat, as: CmsErrorCat
  alias CMS.Model.Comment

  @doc "Builds one public command result for its current viewer."
  @spec build({:ok, struct()} | {:error, term()}, User.t()) ::
          {:ok, map() | struct()} | {:error, term()}
  def build({:ok, %Comment{} = comment}, %User{} = viewer) do
    InteractionResponse.one(comment, viewer)
  end

  def build({:ok, article}, %User{} = viewer) do
    command_id = Map.get(article, :command_id)
    reaction_outcome = Map.get(article, :reaction_outcome)

    with command_id when is_binary(command_id) <- command_id,
         reaction_outcome when reaction_outcome in [:changed, :unchanged] <- reaction_outcome,
         {:ok, article_stats} <- CMS.ArticleStats.for_article(article),
         interaction when is_map(interaction) <- CMS.Interactions.viewer_state(article, viewer) do
      {:ok,
       %{
         command_id: command_id,
         reaction_outcome: reaction_outcome,
         article_stats: article_stats,
         interaction_state: CMS.Interactions.ReadState.article_state(article_stats, interaction)
       }}
    else
      {:error, _reason} = error -> error
      _ -> {:error, CmsErrorCat.command_result_unavailable()}
    end
  end

  def build({:error, _reason} = error, %User{}), do: error
end
