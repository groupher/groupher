defmodule GroupherServer.CMS.Communities.Commands.Create do
  @moduledoc """
  Creates a Community through the receipt-backed Command boundary.

      createCommunity(commandId)
        -> CMS.Command receipt claim
        -> caller-owned transaction
            -> CreationPersist core row
            -> Lifecycle + root moderator + DocTree setup
            -> presentation Outbox intent
        -> Confirmation / canonical Community recovery
  """

  require Logger

  alias GroupherServer.{Accounts, Analysis, CMS, FrontDesk, Repo}
  alias Accounts.Model.User
  alias CMS.Communities.{CreationPersist, Lifecycle}
  alias CMS.Communities.Moderators.Setup, as: ModeratorSetup
  alias CMS.Communities.Commands.CreateConfirmation
  alias CMS.Model.{Community, CommunityDashboard, Embeds}
  alias Helper.T

  @default_meta Embeds.CommunityMeta.default_meta()
  @default_dashboard CommunityDashboard.default()

  @doc """
  Creates or recovers one Community for a stable client command identity.

  ## Examples

      Create.execute(%{title: "Docs", slug: "docs"}, actor, command_id)
      #=> {:ok, %CMS.Model.Community{}} | {:error, reason}
  """
  @spec execute(map(), User.t(), Ecto.UUID.t()) :: T.domain_res(Community.t())
  def execute(args, %User{} = user, command_id) do
    command_params = Map.drop(args, [:author, :user, "author", "user"])

    %CMS.Command{
      actor: user,
      command_id: command_id,
      operation: :community_create,
      target: {:community_create, user.id},
      params: command_params
    }
    |> CMS.Command.execute(action: &create_action/1, confirmation: CreateConfirmation)
    |> present_create()
  end

  defp create_action(%{actor: %User{} = user, params: args, command_id: command_id}) do
    with {:ok, community} <- CreationPersist.create_core(with_defaults(args), user),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(community.id),
         {:ok, _moderator} <- ModeratorSetup.add_root(community, user),
         {:ok, _tree} <- CMS.DocTree.initialize(community),
         {:ok, canonical} <- FrontDesk.community(community.slug, mode: :internal),
         {:ok, _event} <-
           CMS.Dashboard.Effects.enqueue_presentation_changed(canonical, command_id) do
      provision_web_analysis(canonical)

      {:ok,
       %CreateConfirmation{
         data: %{"community_id" => canonical.id, "command_id" => command_id}
       }}
    end
  end

  defp present_create({:ok, %CreateConfirmation{data: %{"community_id" => id}}}) do
    case Repo.get(Community, id) do
      %Community{} = community -> {:ok, community}
      nil -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_create(error), do: error

  defp with_defaults(args) do
    Map.merge(args, %{meta: @default_meta, dashboard: @default_dashboard})
  end

  defp provision_web_analysis(%Community{} = community) do
    case Analysis.Web.provision_community(community) do
      {:ok, _website_id} ->
        {:ok, :provisioned}

      {:error, _reason} ->
        Logger.warning("Community web analysis provisioning deferred", community_id: community.id)

        {:ok, :deferred}

      _ ->
        {:ok, :deferred}
    end
  end
end
