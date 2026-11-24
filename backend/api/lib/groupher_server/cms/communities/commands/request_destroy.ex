defmodule GroupherServer.CMS.Communities.Commands.RequestDestroy do
  @moduledoc """
  Requests reversible Community destruction through the command receipt boundary.

      CMS.Communities.request_destroy/3
        -> RequestDestroy.execute/3
        -> CMS.Command
        -> Gate / Lifecycle / Confirmation
  """

  use GroupherServer.CommandPipeline,
    adapter: GroupherServer.CMS.CommandPipelineAdapter

  alias GroupherServer.{Accounts, CMS}

  alias CMS.{FrontDesk, Gate}
  alias CMS.Communities.{ErrorCat, Lifecycle, RequestDestroyConfirmation}
  alias CMS.Model.Community
  alias Accounts.Model.User
  alias Helper.T

  @doc "Requests reversible Community destruction through the command receipt boundary."
  @spec execute(Community.t(), User.t(), keyword()) :: T.domain_res(Community.t())
  def execute(%Community{} = community, %User{} = actor, opts) do
    execute_pipeline(community, actor, opts, Keyword.fetch!(opts, :command_id))
  end

  def execute(_community, _actor, _opts), do: {:error, ErrorCat.not_exist("Community")}

  @pipeline operation: :community_request_destroy,
            confirmation: RequestDestroyConfirmation,
            target: :community,
            params: :opts

  receipt_pipeline execute_pipeline(community, actor, opts, command_id) do
    gate(fn candidate -> Gate.check_in_transaction(actor, :request_destroy, candidate) end)

    change(fn canonical, operation_ref ->
      Lifecycle.request_destroy(
        canonical.id,
        Keyword.put(opts, :operation_ref, operation_ref)
      )
      |> case do
        {:ok, _blocker} -> {:ok, %{community: canonical, operation_ref: operation_ref}}
        error -> error
      end
    end)

    confirm(fn %{community: canonical, operation_ref: operation_ref} ->
      {:ok,
       %RequestDestroyConfirmation{
         data: %{
           "community_id" => to_string(canonical.id),
           "community_slug" => canonical.slug,
           "operation_ref" => operation_ref
         }
       }}
    end)

    present(fn confirmation ->
      FrontDesk.community(confirmation.data["community_slug"], mode: :internal)
    end)
  end
end
