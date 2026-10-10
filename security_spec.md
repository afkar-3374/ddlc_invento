# DDLC AI Security Specification & Test Payloads

## Data Invariants
1. Products cannot be created without a valid, unique SKU, positive or zero unit price, positive or zero quantity, name, and category.
2. Purchases require a valid productId, non-negative quantity, non-negative unit price, non-negative gstRate, and total matching calculations.
3. Only authenticated users can read or write business records.
4. System audit logs and stock movements cannot have timestamps or IDs tampered with by unauthorized roles.
5. Critical identifiers must conform to safe regex `^[a-zA-Z0-9_\-]+$`.
6. String fields must have strict length boundaries to prevent Denial of Wallet.

## The Dirty Dozen Payloads (Designed to Fail Validation)
1. **Unauthenticated Read on /products**: Request without auth token. Expected: PERMISSION_DENIED.
2. **Missing SKU on Product Create**: Payload with `{ name: "Resistor" }` missing `sku`, `quantity`, `unitPrice`. Expected: PERMISSION_DENIED.
3. **Negative Stock on Product**: `{ quantity: -10 }`. Expected: PERMISSION_DENIED.
4. **Giant Payload Attack (Denial of Wallet)**: Product name string exceeding 256 chars (e.g. 50,000 characters). Expected: PERMISSION_DENIED.
5. **Path ID Injection**: Document ID containing illegal characters `../hack` or non-regex patterns. Expected: PERMISSION_DENIED.
6. **Shadow Field Injection**: Document write containing forbidden system fields `{ __shadowField: true }`. Expected: PERMISSION_DENIED.
7. **Negative Purchase Quantity**: Purchase entry with `quantity: -5`. Expected: PERMISSION_DENIED.
8. **Invalid Status Transition**: Project status updated to an illegal string like `"corrupted_state"`. Expected: PERMISSION_DENIED.
9. **Tampering with Immutable Product ID in Purchase**: Modifying `purchase.productId` after creation. Expected: PERMISSION_DENIED.
10. **Unauthenticated Write to SKU Counters**: Overwriting SKU sequence without authenticated access. Expected: PERMISSION_DENIED.
11. **Blanket Query Scraping**: Malicious unbounded query without proper collection target. Expected: PERMISSION_DENIED.
12. **Foreign User Impersonation in Audit Logs**: Writing an audit log asserting a different userId than `request.auth.uid`. Expected: PERMISSION_DENIED.
