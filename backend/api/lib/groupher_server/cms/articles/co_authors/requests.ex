defmodule GroupherServer.CMS.Articles.CoAuthors.Requests do
  @moduledoc """
  Facade for Article co-author request validation rules.

      command -> CoAuthors.Requests -> normalized permissions and valid transitions
  """

  alias GroupherServer.CMS
  alias CMS.Articles.CoAuthors.Requests.Rules

  @doc "Validates and normalizes grantable Article permissions."
  defdelegate proposal(permissions), to: Rules

  @doc "Checks an approval against the immutable request proposal."
  defdelegate approve(request, approved), to: Rules

  @doc "Checks that a request is pending at the expected revision and deadline."
  defdelegate pending(request, revision, now), to: Rules
end
