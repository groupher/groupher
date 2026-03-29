formatters =
  case {System.get_env("CI"), :os.type()} do
    {"true", _} -> [ExUnit.CLIFormatter]
    {_, {:unix, :darwin}} -> [ExUnit.CLIFormatter, ExUnitNotifier]
    _ -> [ExUnit.CLIFormatter]
  end

ExUnit.configure(exclude: :later, trace: false, formatters: formatters)
ExUnit.start()

Ecto.Adapters.SQL.Sandbox.mode(GroupherServer.Repo, :manual)
