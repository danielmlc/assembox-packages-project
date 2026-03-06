// ============================================================
// @cs/code-generator — 低代码后端代码生成引擎
// ============================================================

// 核心引擎
export { CodeEngine } from './engine/code-engine';
export { GeneratorPlugin } from './engine/plugin.interface';

// 上下文
export { EntityContext, FieldContext } from './context/entity.context';
export { ModuleContext } from './context/module.context';

// 插件
export { TypeOrmPlugin } from './plugins/typeorm.plugin';
export { ServiceGapPlugin } from './plugins/service-gap.plugin';
export { DtoPlugin } from './plugins/dto.plugin';
export { ModulePlugin } from './plugins/module.plugin';

// 类型
export {
  ModuleConfig,
  EntityConfig,
  FieldConfig,
  CsBaseEntityClass,
  FieldType,
} from './types/meta-schema';

// 工具
export {
  toPascalCase,
  toCamelCase,
  toKebabCase,
  mapFieldTypeToTs,
  mapFieldTypeToDb,
} from './utils/naming';
