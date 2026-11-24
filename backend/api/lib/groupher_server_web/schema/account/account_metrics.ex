defmodule GroupherServerWeb.Schema.Account.Metrics do
  @moduledoc """
  Account query filters, profile and OAuth inputs, and the shared Json scalar.

  The scalar decodes JSON string inputs and passes output values through unchanged.

  Business position:

      GraphQL arguments -> account input types -> Accounts resolvers
  """

  use Absinthe.Schema.Notation
  import GroupherServerWeb.Schema.Helper.Fields

  input_object :mailbox_mentions_filter do
    @desc "Selects read mentions when true and unread mentions when false."
    field(:read, :boolean, default_value: false)
  end

  input_object :mailbox_notifications_filter do
    @desc "Selects read notifications when true and unread notifications when false."
    field(:read, :boolean, default_value: false)
  end

  input_object :user_list_filter do
    @desc "Sort order for the user list."
    field(:sort, :account_sort_enum)
  end

  input_object :user_profile_input do
    @desc "Avatar URL to display on the profile."
    field(:avatar, :string)

    @desc "Display name to show instead of the login."
    field(:nickname, :string)

    @desc "Full profile biography."
    field(:bio, :string)

    @desc "Short profile introduction."
    field(:shortbio, :string)

    @desc "Sex listed on the profile."
    field(:sex, :string)

    @desc "Location to display on the profile."
    field(:location, :string)

    @desc "Email address for the profile."
    field(:email, :string)
  end

  input_object :social_input do
    social_fields()
  end

  # this is for all oauth provider
  input_object :oauth_provider_input do
    @desc "OAuth provider name."
    field(:provider, non_null(:string))

    @desc "Account ID assigned by the OAuth provider."
    field(:provider_id, non_null(:string))

    @desc "Username on the provider account."
    field(:login, :string)

    @desc "Avatar URL from the provider profile."
    field(:avatar, :string)

    @desc "Display name from the provider profile."
    field(:nickname, :string)

    @desc "Email address supplied by the provider."
    field(:email, :string)

    @desc "Locale reported by the provider."
    field(:locale, :string)

    @desc "Link to the account's provider profile."
    field(:link, :string)

    @desc "Biography from the provider profile."
    field(:bio, :string)

    @desc "Country listed on the provider profile."
    field(:country, :string)

    @desc "City listed on the provider profile."
    field(:city, :string)

    @desc "Company listed on the provider profile."
    field(:company, :string)
  end

  input_object :verified_oauth_identity_input do
    @desc "OAuth provider name."
    field(:provider, non_null(:string))

    @desc "Account ID assigned by the OAuth provider."
    field(:provider_id, non_null(:string))

    @desc "Username on the provider account."
    field(:login, :string)

    @desc "Display name from the provider profile."
    field(:nickname, :string)

    @desc "Avatar URL from the provider profile."
    field(:avatar, :string)

    @desc "Email address supplied by the provider."
    field(:email, :string)

    @desc "Locale reported by the provider."
    field(:locale, :string)

    @desc "Link to the account's provider profile."
    field(:link, :string)

    @desc "Biography from the provider profile."
    field(:bio, :string)

    @desc "Country listed on the provider profile."
    field(:country, :string)

    @desc "City listed on the provider profile."
    field(:city, :string)

    @desc "Company listed on the provider profile."
    field(:company, :string)
  end

  # see: https://github.com/absinthe-graphql/absinthe/issues/206
  # https://github.com/absinthe-graphql/absinthe/wiki/Scalar-Recipes
  scalar :json, name: "Json" do
    description("""
    Accepts null or a string containing valid JSON. Returns the resolver's value unchanged.
    """)

    serialize(&encode/1)
    parse(&decode/1)
  end

  @spec decode(Absinthe.Blueprint.Input.String.t()) :: {:ok, term()} | :error
  @spec decode(Absinthe.Blueprint.Input.Null.t()) :: {:ok, nil}
  defp decode(%Absinthe.Blueprint.Input.String{value: value}) do
    case Jason.decode(value) do
      {:ok, result} -> {:ok, result}
      _ -> :error
    end
  end

  defp decode(%Absinthe.Blueprint.Input.Null{}) do
    {:ok, nil}
  end

  defp decode(_) do
    :error
  end

  defp encode(value), do: value
end
