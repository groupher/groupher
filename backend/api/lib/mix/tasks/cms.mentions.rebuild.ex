defmodule Mix.Tasks.Cms.Mentions.Rebuild do
  @shortdoc "Report or rebuild current public Mention facts"

  @moduledoc """
  Reports current-source watermarks or rebuilds them in checkpointed batches.

      CLI options -> canonical source page -> report or locked rebuild

      mix cms.mentions.rebuild --report
      mix cms.mentions.rebuild --apply --batch-size 100
      mix cms.mentions.rebuild --apply --only-failed /persistent/mention_rebuild_failures.json
  """

  use Mix.Task

  alias GroupherServer.CMS.ArtimentMentions.Rebuild

  @switches [
    report: :boolean,
    apply: :boolean,
    force: :boolean,
    batch_size: :integer,
    after: :string,
    only_failed: :string
  ]

  @impl true
  def run(argv) do
    Mix.Task.run("app.start")
    {opts, rest, invalid} = OptionParser.parse(argv, strict: @switches)
    if rest != [] or invalid != [], do: Mix.raise("invalid rebuild arguments")

    report? = Keyword.get(opts, :report, false)
    apply? = Keyword.get(opts, :apply, false)
    if report? == apply?, do: Mix.raise("choose exactly one of --report or --apply")

    batch_size = Keyword.get(opts, :batch_size, 100)
    if batch_size < 1 or batch_size > 100, do: Mix.raise("batch size must be 1..100")

    checkpoint = Keyword.get(opts, :after)
    manifest = Keyword.get(opts, :only_failed, Rebuild.default_manifest())

    result =
      cond do
        report? ->
          Rebuild.report_all(checkpoint, batch_size)

        Keyword.has_key?(opts, :only_failed) ->
          Rebuild.retry_failed(manifest)

        true ->
          Rebuild.apply_all(checkpoint, batch_size, Keyword.get(opts, :force, false), manifest)
      end

    Mix.shell().info(Jason.encode!(result, pretty: true))

    if apply? and result.failures != [] do
      Mix.raise("Mention rebuild has unresolved failed sources in #{manifest}")
    end
  end
end
