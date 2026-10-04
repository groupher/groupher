defmodule GroupherServer.CMS.Articles.Commands.Publish do
  @moduledoc """
  Publishes an Article revision through the Gate, lifecycle and Receipt boundary.

      Article publish request
        -> Gate/version checks and domain writes
        -> immutable Publish Confirmation
        -> Receipt encode/decode on retry
  """

  alias GroupherServer.{Accounts, CMS}
  alias Helper.T
  alias CMS.{Articles, Command, FrontDesk}
  alias Accounts.Model.User
  alias Articles.RevisionResult
  alias Articles.Commands.PublishConfirmation
  alias CMS.Model.{Article, Community}

  @doc "Publishes one ordinary Article Draft with retry-safe command recovery."
  @spec publish(Article.t(), User.t(), keyword()) :: T.domain_res(map())
  def publish(%Article{} = article, %User{} = user, opts) do
    case FrontDesk.community(article.community_id, mode: :internal) do
      {:ok, %Community{} = community} ->
        command = %Command{
          actor: user,
          command_id: Keyword.get(opts, :command_id),
          operation: :article_publish,
          target: article,
          params: opts |> Keyword.delete(:command_id) |> Map.new()
        }

        with {:ok, %PublishConfirmation{} = confirmation} <-
               Command.execute(command,
                 action: &publish_action/1,
                 confirmation: PublishConfirmation
               ) do
          RevisionResult.build(Map.from_struct(confirmation), community)
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  def publish(_article, _actor, _opts),
    do: {:error, Articles.ErrorCat.invalid_publish_actor()}

  @spec publish_action(map()) :: Command.action_result(PublishConfirmation.t())
  defp publish_action(%{
         actor: user,
         target: %Article{id: article_id},
         params: params,
         command_id: command_id
       }) do
    publish_opts =
      params
      |> Map.to_list()
      |> Keyword.put(:skip_effects, true)
      |> Keyword.put(:outbox_command_id, command_id)

    case Articles.publish(article_id, user, publish_opts) do
      {:ok, publish_result} ->
        {:ok,
         %PublishConfirmation{
           article_id: article_id,
           revision_id: publish_result.public.revision_id,
           publication_version: publish_result.public.publication_version,
           first_publish?: Map.get(publish_result, :first_publish?, false),
           changed_fields: Map.get(publish_result, :changed_fields, []),
           published_by_id: Map.get(publish_result, :published_by_id),
           published_at: publish_result.public.published_at
         }}

      {:error, reason} ->
        {:error, reason}
    end
  end

end
