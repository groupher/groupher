defmodule GroupherServer.CMS.Model.ArticleCoAuthorEvent do
  @moduledoc """
  Immutable Article co-author authorization and request audit event.

      command transition -> ArticleCoAuthorEvent -> retained history / attribution
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  schema "article_co_author_events" do
    field(:article_id, Ecto.UUID)
    field(:subject_user_id, :integer)
    field(:member_id, Ecto.UUID)
    field(:actor_type, Ecto.Enum, values: [:user, :system])
    field(:actor_id, :integer)

    field(:type, Ecto.Enum,
      values: [
        :join,
        :remove,
        :exit,
        :grant,
        :revoke,
        :request_create,
        :request_decide,
        :request_cancel,
        :request_expire
      ]
    )

    field(:before_permissions, :map, default: %{})
    field(:after_permissions, :map, default: %{})
    field(:request_id, Ecto.UUID)
    field(:operation_ref, Ecto.UUID)
    field(:operation_index, :integer)
    field(:occurred_at, :utc_datetime)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc "Validates one immutable co-author audit fact."
  def changeset(event, attrs) do
    event
    |> cast(attrs, [
      :article_id,
      :subject_user_id,
      :member_id,
      :actor_type,
      :actor_id,
      :type,
      :before_permissions,
      :after_permissions,
      :request_id,
      :operation_ref,
      :operation_index,
      :occurred_at
    ])
    |> validate_required([
      :article_id,
      :subject_user_id,
      :actor_type,
      :type,
      :before_permissions,
      :after_permissions,
      :operation_ref,
      :operation_index,
      :occurred_at
    ])
    |> validate_number(:subject_user_id, greater_than: 0)
    |> validate_number(:operation_index, greater_than_or_equal_to: 0)
    |> validate_member_id()
    |> validate_actor()
    |> check_constraint(:member_id, name: :article_co_author_events_member_id_check)
    |> unique_constraint([:operation_ref, :operation_index])
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:subject_user_id)
    |> foreign_key_constraint(:actor_id)
    |> foreign_key_constraint(:request_id)
  end

  defp validate_actor(changeset) do
    case {get_field(changeset, :actor_type), get_field(changeset, :actor_id)} do
      {:user, id} when is_integer(id) and id > 0 -> changeset
      {:system, nil} -> changeset
      _ -> add_error(changeset, :actor_id, "does not match actor_type")
    end
  end

  defp validate_member_id(changeset) do
    type = get_field(changeset, :type)
    member_id = get_field(changeset, :member_id)

    if type in [:join, :remove, :exit, :grant, :revoke] and is_nil(member_id) do
      add_error(changeset, :member_id, "is required for member events")
    else
      changeset
    end
  end
end
