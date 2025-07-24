module Api
  class BankAccount < Api::ApplicationRecord
    belongs_to :organizations_view, foreign_key: :organization_id
    belongs_to :subject, polymorphic: true, touch: true, optional: true

    has_many :transactions
    has_many :incomes
  end
end