defmodule GroupherServer.Payments.Delegate.Actions do
  @moduledoc """
  actions after billing state success
  """
  import Helper.Utils, only: [get_config: 2]

  alias Helper.ORM

  alias GroupherServer.{Accounts, Messaging, Payments}

  alias Accounts.Model.User
  alias Payments.Model.BillRecord

  @senior_amount_threshold get_config(:general, :senior_amount_threshold)

  def after_bill(%BillRecord{payment_usage: "donate", amount: amount} = record, :done) do
    plan = if amount >= @senior_amount_threshold, do: :senior, else: :donate

    with {:ok, _} <- Accounts.Customizations.upgrade_by_plan(%User{id: record.user_id}, plan) do
      send_thanks_email(record)
      {:ok, record}
    end
  end

  def after_bill(%BillRecord{payment_usage: "senior"} = record, :done) do
    with {:ok, _} <- Accounts.Customizations.upgrade_by_plan(%User{id: record.user_id}, :senior) do
      send_thanks_email(record)
      {:ok, record}
    end
  end

  def after_bill(%BillRecord{payment_usage: "sponsor"} = record, :done) do
    with {:ok, _} <- Accounts.Customizations.upgrade_by_plan(%User{id: record.user_id}, :sponsor) do
      send_thanks_email(record)
      {:ok, record}
    end
  end

  def after_bill(%BillRecord{payment_usage: _payment_usage}, _state) do
    # {:error, "mismatch action"}
    {:ok, :pass}
  end

  defp send_thanks_email(%BillRecord{} = record) do
    with {:ok, user} <- ORM.find(User, record.user_id, preload: :achievement) do
      Messaging.notify(:thanks_donation, %{
        user_id: user.id,
        login: user.login,
        nickname: user.nickname,
        email: user.email,
        bill_record_id: record.id,
        amount: record.amount,
        payment_usage: record.payment_usage
      })
    end
  end
end
