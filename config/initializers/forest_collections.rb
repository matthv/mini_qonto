# Load Forest Liana collections after initialization
Rails.application.config.after_initialize do
  Dir[Rails.root.join("lib/forest_liana/collections/**/*.rb")].each do |file|
    require file
  end
end
