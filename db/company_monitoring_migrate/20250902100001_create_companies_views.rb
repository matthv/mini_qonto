class CreateCompaniesViews < ActiveRecord::Migration[7.0]
  def change
    create_table :companies_views, id: false do |t|
      t.primary_key :id
      t.bigint :organization_id
      t.string :country_code
      t.string :siren
      t.string :creditsafe_safenumber
      t.string :organization_status
      t.datetime :created_at, precision: 6
      t.string :algorithm_check_status
      t.string :algorithm_check_desc
      t.datetime :algorithm_check_date, precision: 6
      t.datetime :algorithm_check_created_at, precision: 6
      t.string :collective_procedure_status
      t.datetime :collective_procedure_created_at, precision: 6
    end
  end
end
