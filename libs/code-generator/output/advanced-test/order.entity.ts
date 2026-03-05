import { Entity, Column, PrimaryColumn } from 'typeorm';
import { registerEntity } from '@cs/nest-typeorm';

/**
 * 订单
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
  })
  status!: string;
  @Column({
    name: 'amount',
    type: 'decimal',
    comment: '订单金额',
    precision: 10,
    scale: 2,
  })
  amount!: number;
  @Column({
    name: 'created_at',
    type: 'datetime',
    comment: '创建时间',
    nullable: true,
  })
  createdAt?: Date;
}
