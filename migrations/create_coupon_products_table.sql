-- Migration: Create coupon_products table
-- This table stores the relationship between discount coupons and products
-- Used for retailer_freebies and other coupon types that apply to specific products

CREATE TABLE IF NOT EXISTS sell.coupon_products (
    id SERIAL PRIMARY KEY,
    coupon_id INTEGER NOT NULL REFERENCES sell.discount_coupons(id) ON DELETE CASCADE,
    product_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(coupon_id, product_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coupon_products_coupon_id ON sell.coupon_products(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_products_product_id ON sell.coupon_products(product_id);

-- Add comment to table
COMMENT ON TABLE sell.coupon_products IS 'Stores the relationship between discount coupons and products. Used to specify which products a coupon applies to.';
