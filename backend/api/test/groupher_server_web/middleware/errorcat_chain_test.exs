defmodule GroupherServerWeb.Middleware.ErrorCatChainTest do
  use GroupherServer.TestMate, async: true

  alias GroupherServer.{CMS, Pagi}
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias CMS.Gate.Decision
  alias CMS.Gate.ErrorCat, as: GateErrorCat
  alias GroupherServerWeb.ErrorCat, as: WebErrorCat

  alias GroupherServerWeb.Middleware.{
    ChangesetErrors,
    FrontDesk,
    GeneralError,
    GQLResultFmt,
    Passport
  }

  test "a real invalid FrontDesk article input survives the query middleware chain" do
    resolution = resolution(%{article_path: %{thread: :post}})

    result =
      resolution
      |> then(&FrontDesk.call(&1, :article))
      |> query_error_chain()

    error = CMS.error_cat_invalid_article_path("invalid article input")

    assert [%{extensions: %{code: code}}] = result.errors
    assert code == CMS.ErrorCat.code(error)
    refute inspect(result.errors) =~ "not-found"
  end

  test "Passport rejection remains its declared error after FrontDesk and transport formatting" do
    user = %{cur_passport: %{"global" => %{}}}
    resolution = resolution(%{}, %{cur_user: user})

    rejected = Passport.call(resolution, action: "community.create")

    assert [%ErrorCat.Error{namespace: {:cms, :passport}, code: 4353}] =
             rejected.errors

    result =
      rejected
      |> then(&FrontDesk.call(&1, :article))
      |> query_error_chain()

    error =
      CMS.passport_error_cat_permission_denied("PassportError: your passport not qualified.")

    assert [%{extensions: %{code: code}}] = result.errors
    assert code == CMS.ErrorCat.code(error)
  end

  test "the mutation chain formats changesets and passes declared errors unchanged" do
    changeset =
      {%{}, %{name: :string}}
      |> Ecto.Changeset.cast(%{}, [:name])
      |> Ecto.Changeset.validate_required(:name)

    result =
      resolution(%{}, %{})
      |> Map.put(:errors, [changeset])
      |> GQLResultFmt.call([])
      |> ChangesetErrors.call([])
      |> GeneralError.call([])

    assert [%{extensions: %{code: code}, message: message}] = result.errors
    assert code == WebErrorCat.code(WebErrorCat.changeset(%{message: []}))
    assert is_list(message)
  end

  test "multiple domain errors and a denied Decision each retain their own declared payload" do
    first = CommunityErrorCat.active_application_exists()
    second = CommunityErrorCat.application_not_found()

    decision =
      Decision.deny(
        [GateErrorCat.permission_denied(), GateErrorCat.ancestor_article_archived()],
        %{request_id: "chain-test"}
      )

    result =
      resolution(%{}, %{})
      |> Map.put(:errors, [first, second, decision])
      |> GQLResultFmt.call([])
      |> GeneralError.call([])

    assert Enum.map(result.errors, & &1.extensions.code) == [first.code, second.code, 4606]
    assert Enum.at(result.errors, 2).extensions.actions == ["READ_ONLY_NOTICE"]
  end

  test "Pagi mismatch survives the complete transport formatter with only its allowlisted value" do
    error = Pagi.ErrorCat.config_mismatch(%{mismatch: :revision, private: "must not escape"})

    result =
      resolution(%{}, %{})
      |> Map.put(:errors, [error])
      |> GQLResultFmt.call([])
      |> GeneralError.call([])

    assert [%{extensions: %{code: 4211, mismatch: "revision"}}] = result.errors
    refute inspect(result.errors) =~ "must not escape"
  end

  defp query_error_chain(resolution) do
    resolution
    |> GQLResultFmt.call([])
    |> GeneralError.call([])
  end

  defp resolution(arguments, context \\ %{}) do
    %Absinthe.Resolution{arguments: arguments, context: context, errors: [], value: nil}
  end
end
