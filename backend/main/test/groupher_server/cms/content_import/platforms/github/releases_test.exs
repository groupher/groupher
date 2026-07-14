defmodule GroupherServer.CMS.ContentImport.Platforms.GitHub.ReleasesTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.{Diff, Mapping}
  alias GroupherServer.CMS.ContentImport.Platforms.GitHub.Releases

  defmodule Client do
    def fetch_releases(connection, _opts), do: {:ok, Map.fetch!(connection, :releases)}
  end

  test "uses the GitHub release ID as stable identity and filters draft/prerelease by default" do
    connection = %{
      owner: "groupher",
      repo: "groupher",
      releases: [
        release(101, "v1.0.0", "Stable release"),
        release(102, "v1.1.0-rc.1", "Prerelease", prerelease: true),
        release(103, "v2.0.0", "Draft", draft: true)
      ]
    }

    assert {:ok, snapshot} =
             Releases.fetch(connection,
               client: Client,
               fetched_at: ~U[2026-07-14 00:00:00Z]
             )

    assert snapshot.platform == :github_releases
    assert snapshot.source_ref == "github:groupher/groupher:releases"
    assert [%{external_ref: "github_release:101"} = entry] = snapshot.entries
    assert entry.title == "Stable release"
    assert entry.body_format == :md
    assert entry.metadata["tag_name"] == "v1.0.0"
    assert entry.metadata["published_at"] == "2026-07-10T12:00:00Z"
    assert snapshot.checkpoint["release_count"] == 1
  end

  test "supports include flags and applies the configured post-filter limit" do
    connection = %{
      owner: "groupher",
      repo: "groupher",
      include_drafts: true,
      include_prereleases: true,
      limit: 2,
      releases: [
        release(101, "v1.0.0", "Stable release"),
        release(102, "v1.1.0-rc.1", "Prerelease", prerelease: true),
        release(103, "v2.0.0", "Draft", draft: true)
      ]
    }

    assert {:ok, snapshot} = Releases.fetch(connection, client: Client)

    assert Enum.map(snapshot.entries, & &1.external_ref) == [
             "github_release:101",
             "github_release:102"
           ]
  end

  test "revision can change without producing a false content change" do
    first = %{release(101, "v1.0.0", "Stable release") | "updated_at" => "2026-07-10T12:00:00Z"}
    second = %{first | "updated_at" => "2026-07-11T12:00:00Z"}

    assert {:ok, first_snapshot} =
             Releases.fetch(%{owner: "groupher", repo: "groupher", releases: [first]},
               client: Client
             )

    assert {:ok, second_snapshot} =
             Releases.fetch(%{owner: "groupher", repo: "groupher", releases: [second]},
               client: Client
             )

    [first_entry] = first_snapshot.entries
    [second_entry] = second_snapshot.entries

    assert first_entry.external_ref == second_entry.external_ref
    assert first_entry.content_hash == second_entry.content_hash
    refute first_entry.revision == second_entry.revision
  end

  test "rejects releases without a usable updated_at checkpoint" do
    broken = %{release(101, "v1.0.0", "Stable release") | "updated_at" => "not-a-date"}

    assert {:error, %{code: "github_release_updated_at_invalid"}} =
             Releases.fetch(%{owner: "groupher", repo: "groupher", releases: [broken]},
               client: Client
             )
  end

  test "shared Diff reports edited and deleted releases without deleting local content" do
    first_connection = %{
      owner: "groupher",
      repo: "groupher",
      releases: [
        release(101, "v1.0.0", "Stable release"),
        release(102, "v0.9.0", "Older release")
      ]
    }

    assert {:ok, first_snapshot} = Releases.fetch(first_connection, client: Client)
    [first_entry, deleted_entry] = first_snapshot.entries

    edited = %{release(101, "v1.0.0", "Stable release") | "body" => "Edited release body"}

    assert {:ok, refreshed_snapshot} =
             Releases.fetch(%{first_connection | releases: [edited]}, client: Client)

    mappings = [
      mapping(first_entry, "target:101"),
      mapping(deleted_entry, "target:102")
    ]

    diff =
      Diff.build(refreshed_snapshot, mappings, %{
        "target:101" => "local:101",
        "target:102" => "local:102"
      })

    assert Enum.find(diff.items, &(&1.external_ref == first_entry.external_ref)).status ==
             :source_updated

    assert Enum.find(diff.items, &(&1.external_ref == deleted_entry.external_ref)).status ==
             :source_deleted
  end

  defp release(id, tag, name, opts \\ []) do
    %{
      "id" => id,
      "tag_name" => tag,
      "name" => name,
      "body" => "## Changes\n\nRelease notes with enough content.",
      "html_url" => "https://github.com/groupher/groupher/releases/tag/#{tag}",
      "draft" => Keyword.get(opts, :draft, false),
      "prerelease" => Keyword.get(opts, :prerelease, false),
      "created_at" => "2026-07-10T10:00:00Z",
      "published_at" => "2026-07-10T12:00:00Z",
      "updated_at" => "2026-07-10T12:00:00Z"
    }
  end

  defp mapping(entry, target_ref) do
    Mapping.new!(%{
      connection_ref: "connection:releases",
      external_ref: entry.external_ref,
      thread: :changelog,
      target_ref: target_ref,
      last_imported_revision: entry.revision,
      last_imported_source_hash: entry.content_hash,
      last_imported_local_hash: String.replace(target_ref, "target", "local"),
      last_imported_at: ~U[2026-07-14 00:00:00Z]
    })
  end
end
