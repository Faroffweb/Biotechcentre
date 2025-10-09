
# Known Issues & Future Improvements

This starter project provides a solid foundation but has areas that need further development and refinement for a production-ready application.

## 1. SKU Uniqueness

-   **Issue:** The `products` table has a `UNIQUE(user_id, sku)` constraint. If a user tries to create a product with a `null` or empty string SKU, the uniqueness constraint might behave unexpectedly across different database versions or allow multiple products with "no SKU".
-   **Solution:** Add a `CHECK` constraint to the table to ensure that if an SKU is provided, it is not an empty string. Application-level validation in the frontend and backend should also enforce this.

## 2. Invoice Calculation Triggers

-   **Issue:** The `update_invoice_totals` trigger recalculates the entire invoice total by querying all `invoice_items` every time a single item is added, updated, or deleted. For invoices with many line items, this can become inefficient.
-   **Solution:** Refine the trigger logic to incrementally update the totals based on the change (`NEW` vs `OLD` rows) rather than re-calculating the sum from scratch.

## 3. Stock Management Trigger

-   **Issue:** The `update_stock_on_sale` trigger fires immediately when an `invoice_item` is inserted. This means stock is deducted even if the invoice is still a `draft`. If the draft is deleted, the stock is not returned.
-   **Solution:** The logic should be more sophisticated.
    1.  **Option A:** Create a separate function that is called via RPC when the invoice status changes from `draft` to `sent` or `paid`. This function would iterate through the invoice items and update stock levels.
    2.  **Option B:** Modify the trigger to check the status of the related invoice (`(SELECT status FROM public.invoices WHERE id = NEW.invoice_id)`). This can get complex when handling status changes (e.g., `paid` -> `cancelled`).

## 4. Row Level Security (RLS)

-   **Issue:** The provided `SCHEMA.sql` enables RLS but does not include a comprehensive set of policies. The application is insecure without them.
-   **Solution:** A full set of RLS policies for `SELECT`, `INSERT`, `UPDATE`, and `DELETE` must be written for every table. These policies should ensure users can only access and modify their own data. For example, a user should not be able to add an `invoice_item` to an invoice that does not belong to them.

## 5. Data Validation

-   **Issue:** There is limited server-side data validation. For example, GSTIN format is not validated on the backend. Prices and quantities are not checked to ensure they are non-negative.
-   **Solution:** Implement Postgres `CHECK` constraints and/or trigger functions to validate data before it's inserted or updated, providing a robust layer of security beyond client-side checks.

## 6. PDF Generation

-   **Issue:** The "Export to PDF" functionality currently just uses `window.print()`, which has limited customization and control over the output format.
-   **Solution:** Integrate a dedicated client-side library like `jspdf` and `jspdf-autotable` or a server-side solution (e.g., a Supabase Edge Function using Puppeteer) for generating professional, consistently formatted PDF invoices.
