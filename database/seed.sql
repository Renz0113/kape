-- Optional local catalog data. No customer or administrator credentials are seeded.
INSERT INTO categories (name, slug, description, sort_order) VALUES
    ('Matcha', 'matcha', 'Whisked matcha and matcha-based drinks.', 1),
    ('Coffee', 'coffee', 'Espresso and coffee favourites.', 2),
    ('Seasonal', 'seasonal', 'Limited drinks made for the season.', 3);

INSERT INTO products (category_id, name, slug, description, price, is_active, stock_quantity) VALUES
    ((SELECT id FROM categories WHERE slug = 'matcha'), 'Cloud Nine Matcha', 'cloud-nine-matcha', 'Ceremonial matcha, silky milk, and an espresso twist.', 6.50, TRUE, 30),
    ((SELECT id FROM categories WHERE slug = 'coffee'), 'Honey Oat Latte', 'honey-oat-latte', 'House espresso, oat milk, and wildflower honey.', 5.80, TRUE, 30),
    ((SELECT id FROM categories WHERE slug = 'seasonal'), 'Strawberry Matcha', 'strawberry-matcha', 'Fresh strawberry and a cool matcha finish.', 6.80, TRUE, 20);
