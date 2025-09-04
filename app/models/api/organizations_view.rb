module Api
  class OrganizationsView < Api::ApplicationRecord
    self.table_name = 'organizations'
    has_many :bank_accounts, foreign_key: :organization_id

    has_many :incomes, through: :bank_accounts, foreign_key: :organization_id
    has_many :transactions, through: :bank_accounts, foreign_key: :organization_id

    has_one :current_bank_account, class_name: "Api::BankAccount", foreign_key: :organization_id
  end
end