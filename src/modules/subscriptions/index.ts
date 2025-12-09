/**
 * Subscriptions Module
 * Enterprise-grade subscription state machine with validation and audit
 * 
 * @module Subscriptions
 */

// Entities
export { SubscriptionStateEntity, SUBSCRIPTION_STATES } from './entities/subscription-state.entity';

// Repositories
export { SubscriptionStateTransitionRepository } from './repositories/subscription-state-transition.repository';
export type { CreateStateTransitionDto, StateTransitionRecord } from './repositories/subscription-state-transition.repository';

// Services
export { SubscriptionStateMachineService } from './services/subscription-state-machine.service';
export type { StateTransitionTrigger, StateTransitionContext, StateTransitionResult } from './services/subscription-state-machine.service';

export { SubscriptionEventEmitterService } from './services/subscription-event-emitter.service';
export type { SubscriptionEventHandler } from './services/subscription-event-emitter.service';

// Events
export {
  SubscriptionStateChangedEvent,
  SubscriptionActivatedEvent,
  SubscriptionCanceledEvent,
  SubscriptionPaymentFailedEvent,
  SubscriptionPastDueEvent,
  SubscriptionEventType,
} from './events/subscription-state.events';

