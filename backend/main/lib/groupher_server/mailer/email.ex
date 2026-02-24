defmodule GroupherServer.Email do
  @moduledoc """
  the email dispatch system for Groupher

  welcome_email -> send to new register
  """
  import Bamboo.Email
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.Payment.Model.BillRecord

  alias GroupherServer.Mailer

  @support_email get_config(:system_emails, :support_email)
  @admin_email get_config(:system_emails, :admin_email)

  def welcome(%User{email: email} = user) when not is_nil(email) do
    if welcome_new_register_enabled?() do
      base_mail()
      |> to(email)
      |> subject("欢迎来到 Groupher")
      |> html_body(GroupherServer.Email.Templates.Welcome.html(user))
      |> text_body(GroupherServer.Email.Templates.Welcome.text())
      |> Mailer.deliver_later()
    else
      {:ok, :pass}
    end
  end

  #  user has no email log to somewhere
  def welcome(_user) do
    {:ok, :pass}
  end

  def thanks_donation(%User{email: email} = user, %BillRecord{} = record) do
    base_mail()
    |> to(email)
    |> subject("感谢你的打赏")
    |> html_body(GroupherServer.Email.Templates.ThanksDonation.html(user, record))
    |> text_body(GroupherServer.Email.Templates.ThanksDonation.text())
    |> Mailer.deliver_later()
  end

  #  notify admin when new user register
  def notify_admin(%User{} = user, :new_register) do
    if notify_admin_on_new_user_enabled?() do
      base_mail()
      |> to(@admin_email)
      |> subject("新用户(#{user.nickname})注册")
      |> html_body(GroupherServer.Email.Templates.NotifyAdminRegister.html(user))
      |> text_body(GroupherServer.Email.Templates.NotifyAdminRegister.text())
      |> Mailer.deliver_later()
    else
      {:ok, :pass}
    end
  end

  def notify_admin(_user, :new_register) do
    {:ok, :pass}
  end

  #  notify admin when someone donate
  def notify_admin(%BillRecord{} = record, :payment) do
    base_mail()
    |> to(@admin_email)
    |> subject("打赏 #{record.amount} 元")
    |> html_body(GroupherServer.Email.Templates.NotifyAdminPayment.html(record))
    |> text_body(GroupherServer.Email.Templates.NotifyAdminPayment.text())
    |> Mailer.deliver_later()
  end

  #  notify admin when new post has created
  def notify_admin(%{type: type, title: title} = info, :new_article) do
    if notify_admin_on_content_created_enabled?() do
      base_mail()
      |> to(@admin_email)
      |> subject("new #{type}: #{title}")
      |> html_body(GroupherServer.Email.Templates.NotifyAdminOnContentCreated.html(info))
      |> text_body(GroupherServer.Email.Templates.NotifyAdminOnContentCreated.text(info))
      |> Mailer.deliver_later()
    else
      {:ok, :pass}
    end
  end

  # some one comment to your post ..
  # the author's publish content being deleted ..
  # ...

  defp base_mail do
    new_email()
    |> from(@support_email)
  end

  defp welcome_new_register_enabled?, do: get_config(:system_emails, :welcome_new_register)
  defp notify_admin_on_new_user_enabled?, do: get_config(:system_emails, :notify_admin_on_new_user)

  defp notify_admin_on_content_created_enabled? do
    get_config(:system_emails, :notify_admin_on_content_created)
  end
end
