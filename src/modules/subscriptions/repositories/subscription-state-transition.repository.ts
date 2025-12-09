/**
 * Subscription State Transition Repository
 * Data access layer for state transition audit records
 * 
 * @module Subscriptions
 */

import { PrismaClient, SubscriptionState, Prisma } from '@prisma/client';

export interface CreateStateTransitionDto {
  subscriptionId: string;
  fromState: SubscriptionState;
  toState: SubscriptionState;
  trigger: string;
  triggerId?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface StateTransitionRecord {
  id: string;
  subscriptionId: string;
  fromState: SubscriptionState;
  toState: SubscriptionState;
  trigger: string;
  triggerId?: string;
  reason?: string;
  createdAt: Date;
}

export class SubscriptionStateTransitionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create state transition record
   */
  async create(
    data: CreateStateTransitionDto,
    tx?: Prisma.TransactionClient
  ): Promise<{
    id: string;
    subscriptionId: string;
    fromState: SubscriptionState;
    toState: SubscriptionState;
    trigger: string;
    createdAt: Date;
  }> {
    const client = tx || this.prisma;

    const result = await client.subscriptionStateTransition.create({
      data: {
        subscriptionId: data.subscriptionId,
        fromState: data.fromState,
        toState: data.toState,
        trigger: data.trigger,
        triggerId: data.triggerId,
        reason: data.reason,
        metadata: data.metadata as Prisma.InputJsonValue,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
      select: {
        id: true,
        subscriptionId: true,
        fromState: true,
        toState: true,
        trigger: true,
        createdAt: true,
      },
    });

    return result;
  }

  /**
   * Find transitions by subscription ID
   */
  async findBySubscriptionId(
    subscriptionId: string,
    limit = 50,
    tx?: Prisma.TransactionClient
  ): Promise<StateTransitionRecord[]> {
    const client = tx || this.prisma;

    const results = await client.subscriptionStateTransition.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        subscriptionId: true,
        fromState: true,
        toState: true,
        trigger: true,
        triggerId: true,
        reason: true,
        createdAt: true,
      },
    });

    return results;
  }

  /**
   * Find transitions by state
   */
  async findByState(
    state: SubscriptionState,
    limit = 100
  ): Promise<StateTransitionRecord[]> {
    const results = await this.prisma.subscriptionStateTransition.findMany({
      where: {
        OR: [{ fromState: state }, { toState: state }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        subscriptionId: true,
        fromState: true,
        toState: true,
        trigger: true,
        triggerId: true,
        reason: true,
        createdAt: true,
      },
    });

    return results;
  }

  /**
   * Get transition statistics
   */
  async getTransitionStats(subscriptionId: string): Promise<{
    totalTransitions: number;
    lastTransition?: Date;
    currentState?: SubscriptionState;
  }> {
    const [count, lastTransition, subscription] = await Promise.all([
      this.prisma.subscriptionStateTransition.count({
        where: { subscriptionId },
      }),
      this.prisma.subscriptionStateTransition.findFirst({
        where: { subscriptionId },
        orderBy: { createdAt: 'desc' },
        select: { toState: true, createdAt: true },
      }),
      this.prisma.subscription.findUnique({
        where: { id: subscriptionId },
        select: { status: true },
      }),
    ]);

    return {
      totalTransitions: count,
      lastTransition: lastTransition?.createdAt,
      currentState: subscription?.status,
    };
  }
}

