import { Entity, Column, PrimaryColumn } from 'typeorm';
import { registerEntity } from '@cs/nest-typeorm';

/**
 * 订单主表
 * 该表位于数据库中
 */
@Entity('orders')
export class Order {
  @PrimaryColumn({
    name: 'id',
    type: 'bigint',
    comment: '订单ID',
  })
  id!: string;
  @Column({
    name: 'order_no',
    type: 'varchar',
    comment: '订单编号',
    length: 50,
  })
  orderNo!: string;
  @Column({
    name: 'customer_id',
    type: 'bigint',
    comment: '客户ID',
  })
  customerId!: string;
  @Column({
    name: 'status',
    type: 'varchar',
    comment: '订单状态',
    length: 20,
    default: 'pending',
  })
  status!: string;
  @Column({
    name: 'total_amount',
    type: 'decimal',
    comment: '订单总金额',
    precision: 10,
    scale: 2,
    default: '0',
  })
  totalAmount!: number;
  @Column({
    name: 'created_at',
    type: 'datetime',
    comment: '创建时间',
    nullable: true,
  })
  createdAt?: Date;
  @Column({
    name: 'remark',
    type: 'varchar',
    comment: '备注',
    length: 500,
    nullable: true,
  })
  remark?: string;
}
