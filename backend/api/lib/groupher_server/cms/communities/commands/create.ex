defmodule GroupherServer.CMS.Communities.Commands.Create do
  @moduledoc """
  Creates a Community through a `receipt_pipeline`.

      createCommunity(commandId)
        -> CMS.Command receipt claim
        -> caller-owned transaction
            -> CreationPersist core row
            -> Lifecycle + root moderator + DocTree setup
            -> presentation Outbox intent
        -> Confirmation / canonical Community recovery
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS, FrontDesk, ReviewBot}
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
    execute_pipeline({:community_create, user.id}, command_params, user, command_id)
  end

  @pipeline operation: :community_create,
            confirmation: CreateConfirmation,
            target: :create_target,
            params: :args

  receipt_pipeline execute_pipeline(create_target, args, user, command_id) do
    gate(fn target -> CMS.Gate.check_community_create_in_transaction(user, target) end)
    change(fn _target -> create_community(args, user, command_id) end)
    confirm(fn confirmation -> {:ok, confirmation} end)
    present(fn confirmation -> present_create(confirmation) end)
  end

  defp create_community(args, %User{} = user, command_id) do
    with {:ok, community} <- CreationPersist.create_core(with_defaults(args), user),
         {:ok, _lifecycle} <- Lifecycle.ensure_created(community.id),
         {:ok, _review_bot_configs} <-
           ReviewBot.create_default_configs_for_community(community.id),
         {:ok, _moderator} <- ModeratorSetup.add_root(community, user),
         {:ok, _tree} <- CMS.DocTree.initialize(community),
         {:ok, canonical} <- FrontDesk.community(community.slug, mode: :internal),
         {:ok, _event} <-
           CMS.Dashboard.Effects.enqueue_presentation_changed(canonical, command_id),
         {:ok, _event} <-
           CMS.Communities.Effects.enqueue_analysis_provision(canonical, command_id) do
      {:ok,
       %CreateConfirmation{
         data: %{"community_id" => canonical.id, "command_id" => command_id}
       }}
    end
  end

  defp present_create(%CreateConfirmation{data: %{"community_id" => id}}) do
    case FrontDesk.community(id, mode: :internal) do
      {:ok, %Community{} = community} -> {:ok, community}
      {:error, _reason} -> {:error, CMS.ErrorCat.command_result_unavailable()}
    end
  end

  defp present_create(_confirmation), do: {:error, CMS.ErrorCat.command_result_unavailable()}

  defp with_defaults(args) do
    Map.merge(args, %{meta: @default_meta, dashboard: @default_dashboard})
  end
end
