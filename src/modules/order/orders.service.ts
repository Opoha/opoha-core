import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { OrderLineEntity } from './entities/order-line.entity';
import { OrderEntity } from './entities/order.entity';
import type { OrderLineType, OrderType } from './order.types';

function toLineType(row: OrderLineEntity): OrderLineType {
  return {
    id: row.id,
    orderId: row.orderId,
    variantId: row.variantId,
    quantity: row.quantity,
    unitPriceMinor: String(row.unitPriceMinor),
    lineTotalMinor: String(row.lineTotalMinor),
    createdAt: row.createdAt,
  };
}

function toOrderType(row: OrderEntity, lines: OrderLineEntity[]): OrderType {
  return {
    id: row.id,
    customerId: row.customerId,
    cartId: row.cartId,
    status: row.status,
    currencyCode: row.currencyCode,
    subtotalMinor: String(row.subtotalMinor),
    taxMinor: String(row.taxMinor),
    shippingMinor: String(row.shippingMinor),
    totalMinor: String(row.totalMinor),
    lines: lines.map(toLineType),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Read surface for orders (place-order lands in D-04). */
@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(OrderEntity)
    private readonly orders: Repository<OrderEntity>,
    @InjectRepository(OrderLineEntity)
    private readonly lines: Repository<OrderLineEntity>,
  ) {}

  async findAll(): Promise<OrderType[]> {
    const rows = await this.orders.find({ order: { createdAt: 'ASC' } });
    return Promise.all(rows.map((row) => this.hydrate(row)));
  }

  async findById(id: string): Promise<OrderType> {
    const row = await this.orders.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return this.hydrate(row);
  }

  private async hydrate(row: OrderEntity): Promise<OrderType> {
    const lines = await this.lines.find({
      where: { orderId: row.id },
      order: { createdAt: 'ASC' },
    });
    return toOrderType(row, lines);
  }
}
