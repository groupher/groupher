defmodule GroupherServer.CMS.Communities.Categories.Commands.Create do
  @moduledoc """
  Creates a Category through the receipt-backed Command boundary.

      GraphQL -> Categories.Commands.Create -> Gate -> Persist -> Receipt
  """

  alias GroupherServer.CMS
  alias CMS.{Command, Gate}
  alias CMS.Communities.Categories.{Confirmation, Persist}
  alias CMS.Communities.Categories.Commands.Support
  alias CMS.Model.{Category, Community}
  alias GroupherServer.Accounts.Model.User
  alias Helper.T
  alias Helper.Validator.Slug

  @spec execute(Community.t() | String.t(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Category.t())
  def execute(community_ref, attrs, %User{} = actor, command_id) when is_map(attrs) do
    with {:ok, community} <- Support.community(community_ref) do
      command = %Command{
        actor: actor,
        command_id: command_id,
        operation: :category_create,
        target: community,
        params: %{attrs: attrs}
      }

      with {:ok, confirmation} <-
             Command.execute(command, action: &action/1, confirmation: Confirmation) do
        Support.category_result(confirmation)
      end
    end
  end

  defp action(%{actor: actor, target: community, params: %{attrs: attrs}, command_id: command_id}) do
    Gate.with_community_check(actor, :category_create, community, fn canonical ->
      with {:ok, author} <- CMS.Articles.Writer.ensure_author_exists(actor),
           attrs <- attrs |> Map.drop([:community, "community"]) |> Map.update(:slug, nil, &Slug.normalize/1),
           {:ok, %Category{} = category} <- Persist.insert_category(attrs, canonical, author.id) do
        {:ok, Support.confirmation(Confirmation, "category_id", category.id, command_id)}
      end
    end)
  end
end
