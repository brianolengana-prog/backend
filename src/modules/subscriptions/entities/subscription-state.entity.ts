/**
 * Subscription State Entity
 * Domain entity representing subscription state with business logic
 * 
 * @module Subscriptions
 */

import { SubscriptionState } from '@prisma/client';

export class SubscriptionStateEntity {
  constructor(
    public readonly value: SubscriptionState,
    public readonly displayName: string,
    public readonly description: string,
    public readonly isActive: boolean,
    public readonly isTerminal: boolean
  ) {}

  /**
   * Check if state represents an active subscription
   */
  isSubscriptionActive(): boolean {
    return this.isActive && !this.isTerminal;
  }

  /**
   * Check if state allows usage
   */
  allowsUsage(): boolean {
    return [
      SubscriptionState.ACTIVE,
      SubscriptionState.TRIALING,
    ].includes(this.value);
  }

  /**
   * Check if state requires payment
   */
  requiresPayment(): boolean {
    return [
      SubscriptionState.PAST_DUE,
      SubscriptionState.UNPAID,
      SubscriptionState.INCOMPLETE,
    ].includes(this.value);
  }
}

/**
 * Subscription state definitions
 */
export const SUBSCRIPTION_STATES: Record<SubscriptionState, SubscriptionStateEntity> = {
  [SubscriptionState.INCOMPLETE]: new SubscriptionStateEntity(
    SubscriptionState.INCOMPLETE,
    'Incomplete',
    'Subscription setup not completed',
    false,
    false
  ),
  [SubscriptionState.INCOMPLETE_EXPIRED]: new SubscriptionStateEntity(
    SubscriptionState.INCOMPLETE_EXPIRED,
    'Incomplete Expired',
    'Subscription setup expired',
    false,
    true
  ),
  [SubscriptionState.TRIALING]: new SubscriptionStateEntity(
    SubscriptionState.TRIALING,
    'Trialing',
    'Subscription in trial period',
    true,
    false
  ),
  [SubscriptionState.ACTIVE]: new SubscriptionStateEntity(
    SubscriptionState.ACTIVE,
    'Active',
    'Subscription is active and paid',
    true,
    false
  ),
  [SubscriptionState.PAST_DUE]: new SubscriptionStateEntity(
    SubscriptionState.PAST_DUE,
    'Past Due',
    'Payment failed, subscription past due',
    false,
    false
  ),
  [SubscriptionState.CANCELED]: new SubscriptionStateEntity(
    SubscriptionState.CANCELED,
    'Canceled',
    'Subscription has been canceled',
    false,
    true
  ),
  [SubscriptionState.UNPAID]: new SubscriptionStateEntity(
    SubscriptionState.UNPAID,
    'Unpaid',
    'Subscription unpaid and access revoked',
    false,
    true
  ),
  [SubscriptionState.PENDING_CANCELLATION]: new SubscriptionStateEntity(
    SubscriptionState.PENDING_CANCELLATION,
    'Pending Cancellation',
    'Subscription will cancel at period end',
    true,
    false
  ),
};

