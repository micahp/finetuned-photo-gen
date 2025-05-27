import { stripe } from '../index'; // This will fail initially
import Stripe from 'stripe';

describe('Stripe Client', () => {
  it('should be a valid Stripe object', () => {
    expect(stripe).toBeInstanceOf(Stripe);
  });

  it('should have the core services available (e.g., customers)', () => {
    // Check if a core service like 'customers' is available on the Stripe instance.
    // This indicates the client is likely initialized correctly.
    expect(stripe.customers).toBeDefined();
  });
}); 