const { createDbPool } = require("../db_config/db");
const ambarsariyaPool = createDbPool();

const post_products = async (req, res) => {
    const {products, categories} = req.body;
    const shopNo = products[0].shop_no; // Assuming all products belong to the same shop_no

    ambarsariyaPool.query("BEGIN"); // Start a transaction
    try {
        await ambarsariyaPool.query("BEGIN"); // Start a transaction

        for(let category of categories){
            // 🔴 Step 1: Delete existing products for the given shop_no
            const deleteQuery = `DELETE FROM Sell.products WHERE shop_no = $1 AND category= $2;`;
            await ambarsariyaPool.query(deleteQuery, [shopNo, category]);
        }

        // Insert products and product variants
        for (let product of products) {
            // Insert the variant group if it doesn't exist
            const variantQuery = `INSERT INTO Sell.product_variants (variant_group) 
                            VALUES ($1) 
                            ON CONFLICT (variant_group) DO NOTHING;`;
            await ambarsariyaPool.query(variantQuery, [product.variant_group]);

            // Insert the product data
            const productQuery = `INSERT INTO Sell.products (
        shop_no, 
        product_name, 
        product_type, 
        product_description, 
        category, 
        price, 
        brand, 
        product_images, 
        product_dimensions_width_in_cm, 
        product_dimensions_height_in_cm, 
        product_dimensions_breadth_in_cm, 
        product_weight_in_kg, 
        packing, 
        product_style, 
        inventory_or_stock_quantity, 
        shipping_information, 
        variant_group, 
        features, 
        keywords, 
        warranty_or_guarantee, 
        expiry_date, 
        manufacturer_details, 
        manufacturing_date, 
        compliance_and_certifications, 
        return_policy, 
        customer_reviews_and_ratings, 
        promotion_information, 
        related_products, 
        variation_1, 
        variation_2, 
        variation_3, 
        variation_4, 
        selling_price,
        product_catalog,
        brand_catalog
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, 
        $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35
      ) ON CONFLICT (product_id) DO NOTHING;`;

            await ambarsariyaPool.query(productQuery, [
                product.shop_no,
                product.product_name,
                product.product_type,
                product.product_description,
                product.category,
                product.price,
                product.brand,
                product.product_images,
                product.product_dimensions_width_in_cm,
                product.product_dimensions_height_in_cm,
                product.product_dimensions_breadth_in_cm,
                product.product_weight_in_kg,
                product.packing,
                product.product_style,
                product.inventory_or_stock_quantity,
                product.shipping_information,
                product.variant_group,
                product.features,
                product.keywords,
                product.warranty_or_guarantee,
                product.expiry_date,
                product.manufacturer_details,
                product.manufacturing_date,
                product.compliance_and_certifications,
                product.return_policy,
                product.customer_reviews_and_ratings,
                product.promotion_information,
                product.related_products,
                product.variation_1,
                product.variation_2,
                product.variation_3,
                product.variation_4,
                product.selling_price,
                product.product_catalog,
                product.brand_catalog,
            ]);
        }

        await ambarsariyaPool.query("COMMIT"); // Commit transaction if all goes well
        res.status(201).json({ message: "Products added successfully" });
    } catch (err) {
        await ambarsariyaPool.query("ROLLBACK"); // Rollback transaction in case of error
        console.error("Error inserting products or variants:", err);
        res.status(500).json({ error: "Error inserting products" });
    }
};


const get_products = async (req, res) => {
    const { shop_no, product_id } = req.params;
    try{

        let query, result;

        // Check if 'title' exists and set the query accordingly
        if (shop_no && product_id) {
            query = `SELECT * FROM sell.products WHERE shop_no = $1 AND product_id = $2`;
            result = await ambarsariyaPool.query(query, [shop_no, product_id]);
        } else if(shop_no) {
            query = `SELECT * FROM sell.products WHERE shop_no = $1`;
            result = await ambarsariyaPool.query(query, [shop_no]);
        }

        if (result.rowCount === 0) {
            // If no rows are found, assume the shop_no is invalid
            res.status(404).json({ valid: false, message: 'No products are there.' });
        }else {
            res.json({ valid: true, data: result.rows });
        }
        
    }catch(e){
        console.error(e);
        res.status(500).json({ e: "Failed to fetch products" });
    }
}

module.exports = { post_products, get_products };
