defmodule GroupherServer.CMS.ContentImport.ThreadAdapterTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.ContentImport.Plan
  alias GroupherServer.CMS.ContentImport.ThreadAdapter
  alias GroupherServer.CMS.ContentImport.Threads.{Changelog, Doc}

  test "requires every thread to expose a safe Preview projection" do
    assert {:project_preview, 1} in ThreadAdapter.behaviour_info(:callbacks)
  end

  test "thread writes have no standalone apply entry and require the orchestrator transaction" do
    refute function_exported?(Doc, :apply, 3)
    refute function_exported?(Changelog, :apply, 3)

    plan =
      Plan.new!(%{
        thread: :doc,
        items: [],
        assets: [],
        payload:
          Doc.PlanPayload.new!(%{
            schema_version: 1,
            source: %{},
            target: %{},
            tree: %{}
          })
      })

    assert {:error, [%{code: "doc_apply_transaction_required"}]} =
             Doc.apply_in_transaction(plan, %User{}, [])

    changelog_plan =
      Plan.new!(%{
        thread: :changelog,
        items: [],
        assets: [],
        payload:
          Changelog.PlanPayload.new!(%{
            schema_version: 1,
            source: %{},
            target: %{}
          })
      })

    assert {:error, [%{code: "changelog_apply_transaction_required"}]} =
             Changelog.apply_in_transaction(changelog_plan, %User{}, [])
  end
end
