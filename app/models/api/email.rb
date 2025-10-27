module Api
  class Email < ApplicationRecord
    has_many :delivery_records,
             dependent: nil,
             inverse_of: :recipient_email,
             foreign_key: :to,
             primary_key: :email
  end
end
