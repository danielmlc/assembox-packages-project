import { Entity, Column, PrimaryColumn } from 'typeorm';
import { registerEntity } from '@cs/nest-typeorm';

/**
 * 常用字段示例表
 * 该表位于数据库中
 */
@Entity('common_fields_demo')
export class CommonFields {
  @PrimaryColumn({
    name: 'id',
    type: 'bigint',
    comment: '主键',
  })
  id!: string;
  @PrimaryColumn({
    name: 'tenant',
    type: 'varchar',
    comment: '租户编码',
    length: 50,
  })
  tenant!: string;
  @PrimaryColumn({
    name: 'order_id',
    type: 'bigint',
    comment: '单据主键',
  })
  orderId!: string;
  @Column({
    name: 'code',
    type: 'varchar',
    comment: '编码',
    length: 50,
  })
  code!: string;
  @Column({
    name: 'name',
    type: 'varchar',
    comment: '名称',
    length: 100,
  })
  name!: string;
  @Column({
    name: 'sort_code',
    type: 'int',
    comment: '排序码',
    nullable: true,
    default: '0',
  })
  sortCode?: number;
  @Column({
    name: 'is_enable',
    type: 'tinyint',
    comment: '启用状态',
    nullable: true,
    default: '1',
  })
  isEnable?: number;
  @Column({
    name: 'org_id',
    type: 'bigint',
    comment: '组织机构ID',
    nullable: true,
  })
  orgId?: string;
  @Column({
    name: 'remark',
    type: 'varchar',
    comment: '备注',
    length: 500,
    nullable: true,
  })
  remark?: string;
}

// 注册实体到 common 数据库连接
registerEntity({
  entity: CommonFields,
  connectionName: 'common',
});
