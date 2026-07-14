defmodule GroupherServer.CMS.ContentImport.Platforms.GitHub.RepositoryTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Platforms.GitHub.Repository

  defmodule Client do
    @behaviour GroupherServer.CMS.ContentImport.Platforms.GitHub.Client

    @impl true
    def fetch_repository(connection, _opts) do
      {:ok,
       %{
         head_sha: "commit-head",
         tree_sha: "tree-head",
         truncated: Map.get(connection, :truncated, false),
         entries: Map.fetch!(connection, :tree)
       }}
    end

    @impl true
    def fetch_blob(_connection, blob, _opts), do: {:ok, Map.fetch!(blob, "body")}
  end

  test "uses HEAD SHA for the Snapshot and blob SHA for each Entry revision" do
    connection = %{
      owner: "groupher",
      repo: "docs",
      ref: "main",
      path: "website",
      tree: [
        blob("website/docs/index.md", "blob-doc", "# Home"),
        blob("website/docs/logo.png", "blob-logo", <<1, 2, 3>>),
        blob("other/ignored.md", "blob-other", "ignored")
      ]
    }

    assert {:ok, snapshot} =
             Repository.fetch(connection,
               client: Client,
               max_concurrency: 1,
               fetched_at: ~U[2026-07-14 00:00:00Z]
             )

    assert snapshot.revision == "commit-head"
    assert snapshot.source_ref == "github:groupher/docs@main:website"

    assert Enum.map(snapshot.entries, &{&1.external_ref, &1.revision, &1.kind}) == [
             {"docs/index.md", "blob-doc", :file},
             {"docs/logo.png", "blob-logo", :asset}
           ]
  end

  test "refuses a truncated GitHub tree" do
    connection = %{owner: "groupher", repo: "docs", ref: "main", tree: [], truncated: true}

    assert {:error, %{code: "github_tree_truncated"}} =
             Repository.fetch(connection, client: Client)
  end

  test "rechecks actual downloaded bytes instead of trusting reported tree sizes" do
    understated = blob("docs/index.md", "blob-doc", String.duplicate("x", 20))
    understated = Map.put(understated, "size", 1)

    connection = %{
      owner: "groupher",
      repo: "docs",
      ref: "main",
      tree: [understated]
    }

    assert {:error, %{code: "github_total_size_exceeded"}} =
             Repository.fetch(connection,
               client: Client,
               max_file_bytes: 100,
               max_total_bytes: 10
             )
  end

  defp blob(path, sha, body) do
    %{
      "path" => path,
      "sha" => sha,
      "type" => "blob",
      "size" => byte_size(body),
      "body" => body
    }
  end
end
