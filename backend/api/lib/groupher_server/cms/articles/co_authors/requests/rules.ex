defmodule GroupherServer.CMS.Articles.CoAuthors.Requests.Rules do
  @moduledoc """
  Validates immutable Article co-author proposals and revisioned transitions.

      locked request -> Rules -> command-owned transition
  """

  alias GroupherServer.CMS
  alias CMS.{Model.ArticleCoAuthorRequest, Passport.Catalog}

  @doc "Validates and normalizes grantable Article permissions."
  def proposal(permissions), do: Catalog.validate_permissions(:article, permissions)

  @doc "Checks an approval against the immutable proposal and dependency rules."
  def approve(%ArticleCoAuthorRequest{type: :invite, proposed_permissions: proposed}, approved)
      when is_map(proposed) and is_map(approved) do
    with {:ok, proposed} <- proposal(proposed),
         {:ok, approved} <- proposal(approved),
         true <- approved == proposed do
      {:ok, approved}
    else
      false -> {:error, :approval_outside_proposal}
      {:error, _} = error -> error
    end
  end

  def approve(%ArticleCoAuthorRequest{type: :apply, proposed_permissions: proposed}, approved)
      when is_map(proposed) and is_map(approved) do
    with {:ok, proposed} <- proposal(proposed),
         {:ok, approved} <- proposal(approved),
         true <-
           Enum.all?(approved, fn {key, value} -> value != true or proposed[key] == true end) do
      {:ok, approved}
    else
      false -> {:error, :approval_outside_proposal}
      {:error, _} = error -> error
    end
  end

  def approve(_, _), do: {:error, :invalid_request_approval}

  @doc "Checks a pending request's expected revision and UTC deadline."
  def pending(
        %ArticleCoAuthorRequest{status: :pending, revision: revision, expires_at: expires_at},
        revision,
        %DateTime{} = now
      ) do
    if DateTime.compare(expires_at, now) == :gt do
      {:ok, :pass}
    else
      {:error, :request_expired}
    end
  end

  def pending(%ArticleCoAuthorRequest{status: :pending}, _revision, %DateTime{}) do
    {:error, :request_revision_conflict}
  end

  def pending(%ArticleCoAuthorRequest{}, _revision, %DateTime{}) do
    {:error, :request_already_decided}
  end

  def pending(_, _, _), do: {:error, :invalid_request}
end
