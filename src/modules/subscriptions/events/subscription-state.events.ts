/**
 * Subscription State Events
 * Event definitions for state machine transitions
 * 
 * @module Subscriptions
 */

import { SubscriptionState } from '@prisma/client';

/**
 * Event payload for state change events
 */
export interface SubscriptionStateChangedEvent {
  subscriptionId: string;
  userId: string;
  fromState: SubscriptionState;
  toState: SubscriptionState;
  trigger: 'webhook' | 'user_action' | 'system' | 'admin';
  triggerId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

/**
 * Event payload for subscription activated
 */
export interface SubscriptionActivatedEvent {
  subscriptionId: string;
  userId: string;
  planId: string;
  timestamp: Date;
}

/**
 * Event payload for subscription canceled
 */
export interface SubscriptionCanceledEvent {
  subscriptionId: string;
  userId: string;
  reason?: string;
  cancelAtPeriodEnd: boolean;
  timestamp: Date;
}

/**
 * Event payload for payment failed
 */
export interface SubscriptionPaymentFailedEvent {
  subscriptionId: string;
  userId: string;
  invoiceId?: string;
  amount?: number;
  timestamp: Date;
}

/**
 * Event payload for subscription past due
 */
export interface SubscriptionPastDueEvent {
  subscriptionId: string;
  userId: string;
  daysPastDue: number;
  timestamp: Date;
}

/**
 * Event type definitions
 * In NestJS, these would be used with EventEmitter2
 */
export enum SubscriptionEventType {
  STATE_CHANGED = 'subscription.state.changed',
  ACTIVATED = 'subscription.activated',
  CANCELED = 'subscription.canceled',
  PAYMENT_FAILED = 'subscription.payment.failed',
  PAST_DUE = 'subscription.past.due',
  TRIAL_STARTED = 'subscription.trial.started',
  TRIAL_ENDING = 'subscription.trial.ending',
}

