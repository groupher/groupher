defmodule GroupherServer.CMS.ContentImport.AssetStager.Runner do
  @moduledoc """
  Runs one bounded, retryable staging batch for a Job.

  The caller persists each returned asset before claiming another batch. Global
  and per-host admission remain an orchestrator concern; this runner guarantees
  that one Job never creates an unbounded task set.

      pending / failed Plan.Assets
                   |
                   v
            take bounded batch
                   |
                   v
      Task.async_stream(max_concurrency)
             /       |       \
            v        v        v
         stager    stager    stager
            \        |        /
             v       v       v
           ready / failed assets + diagnostics
                   |
                   v
        caller persists results before next batch

  This runner owns bounded concurrency and retry timing only. Job row locking,
  claim leases, global admission, and durable progress belong to Orchestrator.
  """

  alias GroupherServer.CMS.ContentImport.{AssetStager, Diagnostic, Plan}

  @default_batch_size 20
  @default_concurrency 4
  @default_timeout 30_000

  @type result :: %{
          required(:assets) => [Plan.Asset.t()],
          required(:processed) => non_neg_integer(),
          required(:remaining) => non_neg_integer(),
          required(:diagnostics) => [Diagnostic.t()]
        }

  @spec run_batch([Plan.Asset.t()], module(), AssetStager.context(), keyword()) ::
          {:ok, result()}
  def run_batch(assets, stager, context, opts \\ []) when is_list(assets) and is_atom(stager) do
    batch_size = positive_option(opts, :batch_size, @default_batch_size)
    max_concurrency = positive_option(opts, :max_concurrency, @default_concurrency)
    timeout = positive_option(opts, :timeout, @default_timeout)

    selected = assets |> Enum.with_index() |> Enum.filter(&stageable?/1) |> Enum.take(batch_size)

    results =
      selected
      |> Task.async_stream(
        fn {asset, index} -> {index, stage_with_retry(asset, stager, context, opts)} end,
        max_concurrency: max_concurrency,
        timeout: timeout,
        ordered: true,
        on_timeout: :kill_task
      )
      |> Enum.to_list()

    {updates, diagnostics} = collect_results(selected, results)

    updated_assets =
      assets
      |> Enum.with_index()
      |> Enum.map(fn {asset, index} -> Map.get(updates, index, asset) end)

    remaining = Enum.count(updated_assets, &(&1.status in [:pending, :failed]))

    {:ok,
     %{
       assets: updated_assets,
       processed: map_size(updates),
       remaining: remaining,
       diagnostics: diagnostics
     }}
  end

  defp stageable?({%Plan.Asset{status: status}, _index}), do: status in [:pending, :failed]

  defp stage_with_retry(asset, stager, context, opts) do
    max_attempts = positive_option(opts, :max_attempts, 3)
    do_stage(asset, stager, context, opts, 1, max_attempts, [])
  end

  defp do_stage(asset, stager, context, opts, attempt, max_attempts, diagnostics) do
    with {:ok, staging} <- Plan.Asset.transition(asset, :staging),
         {:ok, terminal} <- stager.stage(staging, context, opts),
         true <- is_struct(terminal, Plan.Asset) and AssetStager.valid_result?(terminal) do
      {terminal, Enum.reverse(diagnostics)}
    else
      {:error, diagnostic} when attempt < max_attempts ->
        retry_asset = failed_asset(asset)
        sleep_backoff(opts, attempt)

        do_stage(retry_asset, stager, context, opts, attempt + 1, max_attempts, [
          diagnostic | diagnostics
        ])

      {:error, diagnostic} ->
        {failed_asset(asset), Enum.reverse([diagnostic | diagnostics])}

      false ->
        diagnostic =
          Diagnostic.error(
            "invalid_asset_stager_result",
            "AssetStager must return a ready or failed Plan.Asset"
          )

        {failed_asset(asset), Enum.reverse([diagnostic | diagnostics])}
    end
  end

  defp failed_asset(%Plan.Asset{status: :staging} = asset) do
    {:ok, failed} = Plan.Asset.transition(asset, :failed)
    failed
  end

  defp failed_asset(%Plan.Asset{status: status} = asset) when status in [:pending, :failed] do
    {:ok, staging} = Plan.Asset.transition(asset, :staging)
    {:ok, failed} = Plan.Asset.transition(staging, :failed)
    failed
  end

  defp collect_results(selected, results) do
    selected
    |> Enum.zip(results)
    |> Enum.reduce({%{}, []}, fn
      {{_asset, index}, {:ok, {result_index, {updated, item_diagnostics}}}},
      {updates, diagnostics}
      when result_index == index ->
        {Map.put(updates, index, updated), diagnostics ++ item_diagnostics}

      {{asset, index}, {:exit, reason}}, {updates, diagnostics} ->
        diagnostic =
          Diagnostic.error(
            "asset_staging_timeout",
            "asset staging task did not complete",
            details: reason
          )

        {Map.put(updates, index, failed_asset(asset)), diagnostics ++ [diagnostic]}
    end)
  end

  defp sleep_backoff(opts, attempt) do
    sleeper = Keyword.get(opts, :sleeper, &Process.sleep/1)
    base = Keyword.get(opts, :retry_backoff, 100)
    sleeper.(base * attempt)
  end

  defp positive_option(opts, key, default) do
    case Keyword.get(opts, key, default) do
      value when is_integer(value) and value > 0 -> value
      _ -> default
    end
  end
end
