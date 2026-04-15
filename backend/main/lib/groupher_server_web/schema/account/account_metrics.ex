defmodule GroupherServerWeb.Schema.Account.Metrics do
  @moduledoc false

  use Absinthe.Schema.Notation
  import GroupherServerWeb.Schema.Helper.Fields

  input_object :mailbox_mentions_filter do
    field(:read, :boolean, default_value: false)
    pagination_args()
  end

  input_object :mailbox_notifications_filter do
    field(:read, :boolean, default_value: false)
    pagination_args()
  end

  @desc "article_filter doc"
  input_object :paged_users_filter do
    pagination_args()
    # field(:when, :when_enum)
    # field(:sort, :sort_enum)
    # field(:community, :string)
  end

  input_object :user_profile_input do
    field(:avatar, :string)
    field(:nickname, :string)
    field(:bio, :string)
    field(:shortbio, :string)
    field(:sex, :string)
    field(:location, :string)
    field(:email, :string)
  end

  input_object :social_input do
    social_fields()
  end

  # this is for all oauth provider
  input_object :oauth_provider_input do
    field(:provider, non_null(:string))
    field(:provider_id, non_null(:string))
    field(:login, non_null(:string))
    field(:avatar, non_null(:string))
    field(:nickname, :string)
    field(:email, :string)
    field(:locale, :string)
    field(:link, :string)
    field(:bio, :string)
    field(:country, :string)
    field(:city, :string)
    field(:company, :string)
    field(:raw, :json)
  end

  # see: https://github.com/absinthe-graphql/absinthe/issues/206
  # https://github.com/absinthe-graphql/absinthe/wiki/Scalar-Recipes
  scalar :json, name: "Json" do
    description("""
    The `Json` scalar type represents arbitrary json string data, represented as UTF-8
    character sequences. The Json type is most often used to represent a free-form
    human-readable json string.
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
