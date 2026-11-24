defmodule GroupherServer.CMS.Communities.Categories.Commands.Create do
  @moduledoc """
  Creates a Category through a `receipt_pipeline`.

      GraphQL -> Categories.Commands.Create -> Gate -> Persist -> Receipt
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.Gate
  alias CMS.Communities.Categories.{Confirmation, Persist}
  alias CMS.Communities.Categories.Commands.Support
  alias CMS.Model.{Category, Community}
  alias Accounts.Model.User
  alias Helper.T
  alias Helper.Validator.Slug

  @doc "Creates a Community category through the retry-safe command pipeline."
  @spec execute(Community.t() | String.t(), map(), User.t(), Ecto.UUID.t()) ::
          T.domain_res(Category.t())
  def execute(community_ref, attrs, %User{} = actor, command_id) when is_map(attrs) do
    with {:ok, community} <- Support.community(community_ref) do
      execute_pipeline(community, attrs, actor, command_id)
    end
  end

  @pipeline operation: :category_create,
            confirmation: Confirmation,
            target: :community,
            params: [:attrs]

  receipt_pipeline execute_pipeline(community, attrs, actor, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :category_create, candidate) end)

    change(fn canonical, _operation_ref ->
      with {:ok, author} <- CMS.Articles.Persist.ensure_author_exists(actor),
           attrs <-
             attrs
             |> Map.drop([:community, "community"])
             |> Map.update(:slug, nil, &Slug.normalize/1),
           {:ok, %Category{} = category} <- Persist.insert_category(attrs, canonical, author.id),
           {:ok, _binding} <- Persist.set_category(canonical, category) do
        {:ok, category}
      end
    end)

    confirm(fn category ->
      {:ok, Support.confirmation(Confirmation, "category_id", category.id, command_id)}
    end)

    present(fn confirmation -> Support.category_result(confirmation) end)
  end
end
