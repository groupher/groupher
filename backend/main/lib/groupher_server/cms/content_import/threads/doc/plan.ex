defmodule GroupherServer.CMS.ContentImport.Threads.Doc.Plan do
  @moduledoc """
  Adds Article lifecycle coordinates to a navigation plan without writing data.

      SourceTree
          |
          v
      NavigationPlanner
          |
          v
      ImportPlan
      +-- target: ArticleBranch(thread=doc, type=preview)
      +-- documents[]: source page -> random article_hash_id
      +-- tree: page docId -> the same article_hash_id
      +-- sourceMappings[]
          |
          v later
      ImportApply
      +-- Articles.Draft.create on Preview
      +-- DocTree draft writes on Preview

  The plan never creates Draft, public, Snapshot, or DocPublishRelease rows.
  Existing source mappings retain their Article identity. New Article
  identities are preallocated and stable within the returned plan; they are
  never derived from source content.
  """

  alias GroupherServer.CMS.ContentImport.Mapping
  alias GroupherServer.CMS.ContentImport.Threads.Doc.NavigationPlanner

  @schema_version 1

  @type target :: %{
          required(:branch_slug) => String.t(),
          optional(:branch_title) => String.t()
        }

  @doc "Builds an in-memory Preview Branch import plan from a SourceTree."
  @spec build(map(), target(), keyword()) :: {:ok, map()} | {:error, map()}
  def build(source_tree, target, opts \\ []) when is_map(source_tree) and is_map(target) do
    with {:ok, branch_slug} <- required_branch_slug(target) do
      navigation_plan = NavigationPlanner.plan(source_tree)
      id_generator = Keyword.get(opts, :id_generator, &Ecto.UUID.generate/0)
      mappings = opts |> Keyword.get(:mappings, []) |> mappings_by_source()
      documents = documents(navigation_plan, id_generator, mappings)
      ids_by_source = Map.new(documents, &{&1["sourceId"], &1["articleHashId"]})

      {:ok,
       %{
         "schemaVersion" => @schema_version,
         "source" => source_tree["source"],
         "target" => %{
           "thread" => "doc",
           "branch" => %{
             "type" => "preview",
             "slug" => branch_slug,
             "title" => Map.get(target, :branch_title, "Imported docs")
           }
         },
         "documents" => documents,
         "tree" => attach_doc_ids(navigation_plan, ids_by_source),
         "sourceMappings" => source_mappings(documents)
       }}
    end
  end

  defp required_branch_slug(%{branch_slug: slug}) when is_binary(slug) and slug != "",
    do: {:ok, slug}

  defp required_branch_slug(_target) do
    {:error,
     %{
       code: "preview_branch_slug_required",
       severity: "error",
       message: "a Preview Branch slug is required for the import plan"
     }}
  end

  defp documents(navigation_plan, id_generator, mappings) do
    navigation_plan["tabs"]
    |> Enum.flat_map(& &1["groups"])
    |> Enum.flat_map(& &1["children"])
    |> Enum.filter(&(&1["type"] == "page"))
    |> Enum.uniq_by(& &1["sourceId"])
    |> Enum.map(fn page ->
      %{
        "sourceId" => page["sourceId"],
        "sourcePath" => page["sourcePath"],
        "articleHashId" => target_ref(page["sourceId"], mappings, id_generator),
        "title" => page["title"],
        "slug" => page["slug"],
        "route" => page["route"],
        "content" => %{"status" => "pending"}
      }
    end)
  end

  defp mappings_by_source(mappings) do
    Map.new(mappings, fn
      %Mapping{external_ref: external_ref, target_ref: target_ref} ->
        {external_ref, target_ref}

      %{external_ref: external_ref, target_ref: target_ref} ->
        {external_ref, target_ref}

      %{"external_ref" => external_ref, "target_ref" => target_ref} ->
        {external_ref, target_ref}

      %{"sourceId" => external_ref, "articleHashId" => target_ref} ->
        {external_ref, target_ref}
    end)
  end

  defp target_ref(source_id, mappings, id_generator) do
    case Map.fetch(mappings, source_id) do
      {:ok, target_ref} -> target_ref
      :error -> id_generator.()
    end
  end

  defp attach_doc_ids(navigation_plan, ids_by_source) do
    Map.update!(navigation_plan, "tabs", fn tabs ->
      Enum.map(tabs, &attach_tab_doc_ids(&1, ids_by_source))
    end)
  end

  defp attach_tab_doc_ids(tab, ids_by_source) do
    Map.update!(tab, "groups", fn groups ->
      Enum.map(groups, &attach_group_doc_ids(&1, ids_by_source))
    end)
  end

  defp attach_group_doc_ids(group, ids_by_source) do
    Map.update!(group, "children", fn children ->
      Enum.map(children, &attach_doc_id(&1, ids_by_source))
    end)
  end

  defp attach_doc_id(%{"type" => "page"} = page, ids_by_source) do
    Map.put(page, "docId", Map.fetch!(ids_by_source, page["sourceId"]))
  end

  defp attach_doc_id(node, _ids_by_source), do: node

  defp source_mappings(documents) do
    Enum.map(documents, fn document ->
      %{
        "sourceId" => document["sourceId"],
        "articleHashId" => document["articleHashId"]
      }
    end)
  end
end
