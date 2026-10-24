defmodule Mix.Tasks.Cms.Pipeline.Check do
  @shortdoc "Compile and validate CMS command pipeline contracts"

  @moduledoc """
  Builds the machine-readable CMS pipeline contracts after compilation.

  `mix cms.pipeline.check` writes `priv/pipeline_contracts.json`.
  `mix cms.pipeline.check --check` is the CI freshness mode and fails when the
  checked-in contracts does not match the compiled modules.

      mix compile
        -> compiled pipeline contracts
        -> contract/compiled-graph checks
        -> JSON freshness result
  """

  use Mix.Task

  alias GroupherServer.CommandPipeline
  alias GroupherServer.CMS

  alias CommandPipeline.{
    CompiledModules,
    GraphAnalyzer,
    ProjectPaths,
    RejectionPurity
  }

  @switches [check: :boolean]
  @manifest "priv/pipeline_contracts.json"
  @cms_adapter CMS.CommandPipelineAdapter

  @impl true
  def run(args) do
    Mix.Task.run("compile", [])
    {opts, _argv, _invalid} = OptionParser.parse(args, strict: @switches)
    check? = Keyword.get(opts, :check, false)

    contracts = contracts()
    validate!(contracts)
    validate_rejection_builders!(contracts)

    manifest = %{
      "schema_version" => 2,
      "app" => Atom.to_string(Mix.Project.config()[:app]),
      "pipelines" => Enum.map(contracts, &manifest_contract/1)
    }

    path = ProjectPaths.expand(@manifest)
    json = Jason.encode!(manifest, pretty: true) <> "\n"

    if check? do
      case File.read(path) do
        {:ok, current} ->
          if Jason.decode(current) == {:ok, manifest} do
            Mix.shell().info("CMS pipeline contracts are fresh: #{path}")
          else
            Mix.raise("CMS pipeline contracts are stale: #{path}")
          end

        {:error, :enoent} ->
          Mix.raise("CMS pipeline contracts are missing: #{path}")

        {:error, reason} ->
          Mix.raise("cannot read CMS pipeline contracts #{path}: #{inspect(reason)}")
      end
    else
      File.mkdir_p!(Path.dirname(path))
      File.write!(path, json)
      Mix.shell().info("Wrote CMS pipeline contracts: #{path}")
    end
  end

  defp contracts do
    modules = CompiledModules.production()

    pipeline_modules =
      modules
      |> Enum.filter(fn module ->
        Code.ensure_loaded?(module) and function_exported?(module, :__pipeline_contracts__, 0)
      end)

    validate_cms_adapter_ownership!(pipeline_modules)

    pipeline_modules
    |> Enum.flat_map(fn module ->
      module.__pipeline_contracts__()
      |> Enum.map(&Map.put(&1, :module, module))
    end)
    |> Enum.filter(&(&1[:adapter] == @cms_adapter and cms_module?(&1.module)))
    |> Enum.sort_by(fn contract ->
      {Atom.to_string(contract.module), Atom.to_string(contract.name)}
    end)
  end

  @doc false
  def validate_cms_adapter_ownership!(modules) when is_list(modules) do
    modules
    |> Enum.filter(fn module ->
      Code.ensure_loaded?(module) and function_exported?(module, :__pipeline_contracts__, 0)
    end)
    |> Enum.filter(&cms_module?/1)
    |> Enum.each(fn module ->
      invalid_adapters =
        module.__pipeline_contracts__()
        |> Enum.map(&Map.get(&1, :adapter))
        |> Enum.uniq()
        |> Enum.reject(&(&1 == @cms_adapter))

      if invalid_adapters != [] do
        Mix.raise(
          "CMS pipeline module #{inspect(module)} must use #{inspect(@cms_adapter)}, got #{inspect(invalid_adapters)}"
        )
      end
    end)

    {:ok, :pass}
  end

  defp cms_module?(module) do
    inspect(module)
    |> then(
      &(String.starts_with?(&1, "GroupherServer.CMS.") or
          String.starts_with?(&1, "GroupherServer.AlertWall.") or
          String.starts_with?(&1, "GroupherServer.ReviewBot."))
    )
  end

  defp validate!(contracts) do
    duplicate_operations =
      contracts
      |> Enum.group_by(& &1.operation)
      |> Enum.filter(fn {_operation, values} -> length(values) > 1 end)

    unless duplicate_operations == [] do
      Mix.raise(
        "duplicate CMS pipeline operations: #{inspect(Enum.map(duplicate_operations, &elem(&1, 0)))}"
      )
    end

    Enum.each(contracts, &ensure_confirmation!/1)
  end

  @doc false
  def validate_rejection_builders!(contracts) do
    modules = contracts |> Enum.map(& &1.module) |> Enum.uniq()
    graph = GraphAnalyzer.build_modules(modules)
    RejectionPurity.validate!(graph, contracts)
  end

  defp ensure_confirmation!(%{pipeline: :direct_pipeline, confirmation: nil}), do: {:ok, :pass}

  defp ensure_confirmation!(%{pipeline: :direct_pipeline} = contract) do
    Mix.raise(
      "direct_pipeline #{inspect(contract.module)}.#{contract.name} has confirmation metadata"
    )
  end

  defp ensure_confirmation!(%{pipeline: :receipt_pipeline, confirmation: confirmation} = contract)
       when is_atom(confirmation) do
    unless Code.ensure_loaded?(confirmation) and function_exported?(confirmation, :operations, 0) and
             function_exported?(confirmation, :encode, 2) and
             function_exported?(confirmation, :decode, 2) do
      Mix.raise(
        "receipt_pipeline #{inspect(contract.module)}.#{contract.name} has no usable Confirmation codec"
      )
    end

    unless contract.operation in confirmation.operations() do
      Mix.raise(
        "Confirmation #{inspect(confirmation)} does not declare #{inspect(contract.operation)}"
      )
    end
  end

  defp ensure_confirmation!(contract) do
    Mix.raise(
      "receipt_pipeline #{inspect(contract.module)}.#{contract.name} has invalid confirmation metadata"
    )
  end

  defp manifest_contract(contract) do
    %{
      "module" => inspect(contract.module),
      "name" => Atom.to_string(contract.name),
      "arity" => contract.arity,
      "target" => contract[:target] && Atom.to_string(contract.target),
      "pipeline" => Atom.to_string(contract.pipeline),
      "operation" => contract[:operation] && Atom.to_string(contract.operation),
      "access" => contract[:access] && Atom.to_string(contract.access),
      "confirmation" => contract[:confirmation] && inspect(contract.confirmation),
      "rejection_builder" =>
        case contract[:rejection_builder] do
          {module, function, arity} ->
            %{
              "module" => inspect(module),
              "function" => Atom.to_string(function),
              "arity" => arity
            }

          _ ->
            nil
        end,
      "stages" => Enum.map(contract[:stages] || [], &Atom.to_string/1),
      "steps" => Enum.map(contract[:steps] || [], &Atom.to_string/1),
      "return" => contract[:return] && Atom.to_string(contract.return)
    }
    |> Enum.reject(fn {_key, value} -> is_nil(value) end)
    |> Map.new()
  end
end
