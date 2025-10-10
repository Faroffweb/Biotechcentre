# Known Issues & Future Improvements

This starter project provides a solid foundation but has areas that need further development and refinement for a production-ready application.

## 1. SKU Uniqueness

-   **Issue:** The `products` table has a `UNIQUE(user_id, sku)` constraint. If a user tries to create a product with a `null` or empty string SKU, the uniqueness constraint might behave unexpectedly across different database versions or allow multiple products with "no SKU".
-   **Solution:** Add a `CHECK` constraint to the table to ensure that if an SKU is provided, it is not an empty string. Application-level validation in the frontend and backend should also enforce this.

## 2. Row Level Security (RLS)

-   **Issue:** The provided `SCHEMA.sql` enables RLS but does not include a comprehensive set of policies. The application is insecure without them.
-   **Solution:** A full set of RLS policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` must be written for every table. These policies should ensure users can only access and modify their own data. For example, a user should not be able to add an `invoice_item` to an invoice that does not belong to them.

## 3. Data Validation

-   **Issue:** There is limited server-side data validation. For example, GSTIN format is not validated on the backend. Prices and quantities are not checked to ensure they are non-negative.
-   **Solution:** Implement Postgres `CHECK` constraints and/or trigger functions to validate data before it's inserted or updated, providing a robust layer of security beyond client-side checks.
