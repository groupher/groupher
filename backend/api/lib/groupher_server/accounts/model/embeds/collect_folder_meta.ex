defmodule GroupherServer.Accounts.Model.Embeds.CollectFolderMeta.Macros do
  @moduledoc """
  Generates per-thread presence and count fields for collection-folder metadata.

  e.g:
    field(:has_post, :boolean, default: false)
    field(:post_count, :integer, default: 0)

  Business position:

      Accounts context
        -> Macros schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias GroupherServer.CMS
  @threads CMS.artiment_config_threads()

  @doc "Declares a `has_<thread>` flag and a `<thread>_count` integer for each configured thread."
  defmacro threads_fields do
    @threads
    |> Enum.map(fn thread ->
      quote do
        field(unquote(:"has_#{thread}"), :boolean, default: false)
        field(unquote(:"#{thread}_count"), :integer, default: 0)
      end
    end)
  end
end

defmodule GroupherServer.Accounts.Model.Embeds.CollectFolderMeta do
  @moduledoc """
  Embedded counters describing which artiment threads a collection folder contains.

  Business position:

      Collection-folder write
        -> CollectFolderMeta changeset
        -> User collection-folder row
        -> Accounts read model
  """

  use Ecto.Schema

  import Ecto.Changeset
  import GroupherServer.Accounts.Model.Embeds.CollectFolderMeta.Macros

  alias GroupherServer.CMS

  @threads CMS.artiment_config_threads()

  @optional_fields Enum.map(@threads, &:"#{&1}_count") ++
                     Enum.map(@threads, &:"has_#{&1}")

  @doc "Returns the empty folder metadata map: every configured thread has count zero and flag false."
  def default_meta do
    @threads
    |> Enum.reduce([], fn thread, acc -> acc ++ ["#{thread}_count": 0, "has_#{thread}": false] end)
    |> Enum.into(%{})
  end

  embedded_schema do
    threads_fields()
  end

  @doc "Casts per-thread counts and presence flags as supplied; it does not derive flags from counts."
  def changeset(struct, params) do
    struct |> cast(params, @optional_fields)
  end
end
