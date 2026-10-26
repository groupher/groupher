defmodule GroupherServerWeb.Resolvers.ReviewBot do
  @moduledoc """
  GraphQL entry points for ReviewBot policy reads and Receipt-backed updates.

  Business position:

      GraphQL ReviewBot field
        -> resolver authorizes system/community scope
          -> ReviewBot config query or update command
  """

  alias GroupherServer.CMS
  alias GroupherServer.{FrontDesk, ReviewBot}
  alias CMS.Model.Community

  def review_bot_config(_parent, %{scope: scope, subject_type: subject_type}, %{context: context}) do
    with {:ok, resolved_scope, community_id} <- resolve_scope(scope),
         actor when not is_nil(actor) <- Map.get(context, :cur_user),
         {:ok, :pass} <- ReviewBot.authorize(resolved_scope, :read, actor),
         {:ok, configs} <- ReviewBot.configs(community_id, subject_type),
         %{} = config <- select_config(configs, resolved_scope) do
      {:ok, config}
    else
      nil -> {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
      {:error, _reason} = error -> error
      _ -> {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
    end
  end

  def update_review_bot_config(_parent, %{input: input, command_id: command_id}, %{
        context: context
      }) do
    with {:ok, scope, _community_id} <- resolve_scope(input.scope),
         actor when not is_nil(actor) <- Map.get(context, :cur_user),
         attrs <- %{
           review_mode: input.review_mode,
           ban_words: input.review_ban_words,
           prompt: input.review_prompt
         } do
      ReviewBot.update_config(
        scope,
        input.subject_type,
        input.expected_version,
        attrs,
        actor,
        command_id
      )
    else
      nil -> {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
      {:error, _reason} = error -> error
      _ -> {:error, GroupherServer.CMS.passport_error_cat_permission_denied()}
    end
  end

  defp resolve_scope(%{type: :platform}), do: {:error, ReviewBot.invalid_config_error()}

  defp resolve_scope(%{type: :community, community: slug}) when is_binary(slug) do
    with {:ok, %Community{} = community} <- FrontDesk.community(slug, mode: :internal) do
      {:ok, %{type: :community, community: community}, community.id}
    end
  end

  defp resolve_scope(_scope), do: {:error, ReviewBot.invalid_config_error()}

  defp select_config(%{community: community}, %{type: :community}), do: community
end
