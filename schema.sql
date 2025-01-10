-- Drop tables if they exist (for clean initialization)
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS products;

-- Products table
CREATE TABLE products (
    itemId TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL NOT NULL CHECK (price > 0),
    description TEXT,
    category TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for product category lookups
CREATE INDEX idx_products_category ON products(category);

-- Orders table
CREATE TABLE orders (
    orderTrackingId TEXT PRIMARY KEY,
    customerAddress TEXT NOT NULL,
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    delivery_fee REAL NOT NULL CHECK (delivery_fee >= 0),
    total REAL NOT NULL CHECK (total >= 0),
    status TEXT NOT NULL CHECK (status IN ('new', 'preparing', 'delivering', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    estimated_delivery_time TEXT
);

-- Create index for order status and date lookups
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Order items table (for the items in each order)
CREATE TABLE order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    orderTrackingId TEXT NOT NULL,
    itemId TEXT NOT NULL,
    itemQuantity INTEGER NOT NULL CHECK (itemQuantity > 0),
    subtotal REAL NOT NULL CHECK (subtotal >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (orderTrackingId) REFERENCES orders(orderTrackingId) ON DELETE CASCADE,
    FOREIGN KEY (itemId) REFERENCES products(itemId)
);

-- Create index for order items lookups
CREATE INDEX idx_order_items_order ON order_items(orderTrackingId);
CREATE INDEX idx_order_items_product ON order_items(itemId);

-- Insert initial product data
INSERT INTO products (itemId, name, price, description, category) VALUES
    -- Traditional Pizzas
    ('p1', 'Margherita Pizza', 12.99, 'Classic tomato and mozzarella', 'Traditional Pizzas'),
    ('p2', 'Pepperoni Pizza', 14.99, 'Spicy pepperoni with cheese', 'Traditional Pizzas'),
    
    -- Specialty Pizzas
    ('p3', 'Hawaiian Pizza', 15.99, 'Ham and pineapple', 'Specialty Pizzas'),
    ('p4', 'Vegetarian Pizza', 13.99, 'Mixed vegetables', 'Specialty Pizzas'),
    
    -- Beverages
    ('b1', 'Coca Cola', 2.99, 'Classic cola drink - 500ml', 'Beverages'),
    ('b2', 'Sprite', 2.99, 'Lemon-lime soda - 500ml', 'Beverages'),
    ('b3', 'Water', 1.99, 'Bottled water - 500ml', 'Beverages'),
    
    -- Desserts
    ('d1', 'Chocolate Cake', 6.99, 'Rich chocolate layer cake', 'Desserts'),
    ('d2', 'Tiramisu', 7.99, 'Classic Italian coffee-flavored dessert', 'Desserts'),
    ('d3', 'Ice Cream', 4.99, 'Vanilla ice cream with chocolate sauce', 'Desserts');

-- Create a trigger to update the updated_at timestamp for products
CREATE TRIGGER update_products_timestamp 
AFTER UPDATE ON products
BEGIN
    UPDATE products 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE itemId = NEW.itemId;
END;

-- Create a trigger to update the updated_at timestamp for orders
CREATE TRIGGER update_orders_timestamp 
AFTER UPDATE ON orders
BEGIN
    UPDATE orders 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE orderTrackingId = NEW.orderTrackingId;
END;

-- Create a view for order summaries
CREATE VIEW order_summaries AS
SELECT 
    o.orderTrackingId,
    o.status,
    o.total,
    o.created_at,
    COUNT(oi.id) as total_items,
    GROUP_CONCAT(p.name || ' (x' || oi.itemQuantity || ')') as items_summary
FROM orders o
LEFT JOIN order_items oi ON o.orderTrackingId = oi.orderTrackingId
LEFT JOIN products p ON oi.itemId = p.itemId
GROUP BY o.orderTrackingId;

-- Create a view for product categories summary
CREATE VIEW category_summaries AS
SELECT 
    category,
    COUNT(*) as total_products,
    MIN(price) as min_price,
    MAX(price) as max_price,
    AVG(price) as avg_price
FROM products
GROUP BY category;