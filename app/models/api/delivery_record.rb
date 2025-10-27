module Api
  class DeliveryRecord < ApplicationRecord
    has_one :recipient_email,
            class_name: 'Api::Email',
            dependent: :nullify,
            inverse_of: :delivery_records,
            foreign_key: :email,
            primary_key: :to
  end
end
