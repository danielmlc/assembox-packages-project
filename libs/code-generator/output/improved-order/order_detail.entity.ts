import { Entity, Column, PrimaryColumn } from 'typeorm';
import { registerEntity } from '@cs/nest-typeorm';

/**
 * 订单明细表
 * 该表位于数据库中
 */
@Entity('order_details')
export class OrderDetail {
  @PrimaryColumn({
    name: 'id',
    type: 'bigint',
    comment: '明细ID',
  })
  id!: string;
  @Column({
    name: 'order_id',
    type: 'bigint',
    comment: '订单ID',
  })
  orderId!: string;
  @Column({
    name: 'product_name',
    type: 'varchar',
    comment: '商品名称',
    length: 200,
  })
  productName!: string;
  @Column({
    name: 'quantity',
    type: 'int',
    comment: '数量',
  })
  quantity!: number;
  @Column({
    name: 'price',
    type: 'decimal',
    comment: '单价',
    precision: 10,
    scale: 2,
  })
  price!: number;
}
