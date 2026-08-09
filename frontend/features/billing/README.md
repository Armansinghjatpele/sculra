# Feature: Billing

Handles Stripe checkout creation, billing portal loops, and plan limit validations.

## File Structure

- `components/`: PricingTable, BillingSummaryCard.
- `hooks/`: `useSubscriptionState`, `useStripeCheckout`.
- `services/`: Sync plans metadata.
- `types/`: Plan tier details.
- `utils/`: Price formatter.
