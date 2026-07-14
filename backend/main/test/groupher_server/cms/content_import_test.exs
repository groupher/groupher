defmodule GroupherServer.CMS.ContentImportTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport
  alias GroupherServer.CMS.ContentImport.{Entry, Plan, Snapshot}
  alias GroupherServer.CMS.ContentImport.Plan.{Asset, Item}
  alias GroupherServer.CMS.ContentImport.Threads.Doc.{ItemPayload, PlanPayload}

  defmodule ThreadAdapter do
    @behaviour GroupherServer.CMS.ContentImport.ThreadAdapter

    @impl true
    def validate(_snapshot, _thread_context, _opts), do: :ok

    @impl true
    def plan(snapshot, _thread_context, _plan_context) do
      send(self(), :thread_plan_called)
      [entry] = snapshot.entries

      item =
        Item.new!(%{
          external_ref: entry.external_ref,
          target_ref: "article:1",
          action: :create,
          source_hash: entry.content_hash,
          payload:
            ItemPayload.new!(%{
              article_hash_id: "article:1",
              content: %{"status" => "normalized"}
            })
        })

      asset =
        Asset.new!(%{asset_key: "logo", source: {:remote_url, "https://example.com/logo.png"}})

      Plan.new(%{
        thread: :doc,
        items: [item],
        assets: [asset],
        payload:
          PlanPayload.new!(%{
            schema_version: 1,
            source: %{"framework" => "test"},
            target: %{"thread" => "doc"},
            tree: %{"tabs" => []}
          })
      })
    end

    @impl true
    def project_preview(_plan), do: {:error, []}

    @impl true
    def apply_in_transaction(_plan, _actor, _opts), do: {:error, []}
  end

  test "planning returns pending assets without invoking a downloader" do
    entry = Entry.new!(%{external_ref: "doc:intro", kind: :file, body: "Intro"})

    snapshot =
      Snapshot.new!(%{
        platform: :test,
        source_ref: "test:1",
        entries: [entry],
        fetched_at: ~U[2026-07-14 00:00:00Z]
      })

    assert {:ok, %Plan{assets: [%Asset{status: :pending}]} = plan} =
             ContentImport.plan(
               ThreadAdapter,
               snapshot,
               %{community_ref: "home", thread: :doc},
               %{mappings: []}
             )

    assert_received :thread_plan_called
    assert {:error, []} = ContentImport.project_preview(ThreadAdapter, plan)
    refute ContentImport.ready_for_apply?(plan)
    refute_received :asset_download_called
  end
end
