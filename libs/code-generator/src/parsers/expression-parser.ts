import { Expression } from '../types/config';

/**
 * 表达式解析上下文
 */
export interface ParseContext {
  /** 循环迭代变量名 */
  itemName?: string;
  /** 循环索引变量名 */
  indexName?: string;
  /** 转换源变量名 */
  sourceName?: string;
}

/**
 * 表达式解析器
 */
export class ExpressionParser {
  /**
   * 解析表达式为代码字符串
   */
  parse(expression: Expression | any, context: ParseContext = {}): string {
    if (expression === null || expression === undefined) {
      return 'null';
    }

    // 字面量对象
    if (typeof expression === 'object' && 'literal' in expression) {
      return this.parseLiteral(expression.literal, context);
    }

    // 表达式字符串
    if (typeof expression === 'object' && 'expr' in expression) {
      return this.parseExpr(expression.expr, context);
    }

    // 直接值
    return this.parseLiteral(expression, context);
  }

  /**
   * 解析字面量
   */
  private parseLiteral(value: any, context: ParseContext): string {
    if (typeof value === 'string') {
      // 检查是否包含表达式
      if (value.includes('${')) {
        return this.parseExpr(value, context);
      }
      return JSON.stringify(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (value === null) {
      return 'null';
    }

    if (Array.isArray(value)) {
      const items = value.map((v) => this.parseLiteral(v, context));
      return `[${items.join(', ')}]`;
    }

    if (typeof value === 'object') {
      const entries = Object.entries(value).map(([k, v]) => {
        const parsedValue = this.parseLiteral(v, context);
        return `${k}: ${parsedValue}`;
      });
      return `{ ${entries.join(', ')} }`;
    }

    return String(value);
  }

  /**
   * 解析表达式字符串
   */
  private parseExpr(expr: string, context: ParseContext): string {
    // 替换所有 ${namespace:path} 模式
    return expr.replace(/\$\{([^}]+)\}/g, (match, content) => {
      const colonIndex = content.indexOf(':');

      if (colonIndex === -1) {
        // 无命名空间，保留原始的 ${} 格式（模板字符串插值）
        return `\${${content}}`;
      }

      const namespace = content.substring(0, colonIndex);
      const path = content.substring(colonIndex + 1);

      switch (namespace) {
        case 'param':
          return `\${${path}}`;
        case 'var':
          return `\${${path}}`;
        case 'ctx':
          return `\${${this.parseContextVar(path)}}`;
        case 'fn':
          return `\${${this.parseFunction(path, context)}}`;
        case 'item':
          return `\${${path ? `${context.itemName || 'item'}.${path}` : context.itemName || 'item'}}`;
        case 'index':
          return `\${${context.indexName || 'index'}}`;
        case 'source':
          return `\${${path ? `${context.sourceName || 'source'}.${path}` : context.sourceName || 'source'}}`;
        default:
          return `\${${content}}`;
      }
    });
  }

  /**
   * 解析上下文变量
   */
  private parseContextVar(path: string): string {
    const contextMap: Record<string, string> = {
      userId: 'this.contextService.getUserId()',
      userName: 'this.contextService.getUserName()',
      tenantId: 'this.contextService.getTenantId()',
      orgId: 'this.contextService.getOrgId()',
    };
    return contextMap[path] || `this.contextService.get('${path}')`;
  }

  /**
   * 解析内置函数
   */
  private parseFunction(funcCall: string, context: ParseContext): string {
    // 简单函数（无参数）
    const simpleFunctions: Record<string, string> = {
      now: 'new Date()',
      uuid: 'uuidv4()',
      snowflake: 'this.idGenerator.nextId()',
    };

    if (simpleFunctions[funcCall]) {
      return simpleFunctions[funcCall];
    }

    // 带参数的函数
    const funcMatch = funcCall.match(/^(\w+)\((.+)\)$/);
    if (funcMatch) {
      const [, funcName, argsStr] = funcMatch;
      const args = this.parseArgs(argsStr, context);

      const functionMap: Record<string, (args: string[]) => string> = {
        isEmpty: (a: string[]) => `isEmpty(${a[0]})`,
        isNotEmpty: (a: string[]) => `!isEmpty(${a[0]})`,
        toNumber: (a: string[]) => `Number(${a[0]})`,
        toString: (a: string[]) => `String(${a[0]})`,
        like: (a: string[]) => `Like(\`%\${${a[0]}}%\`)`,
      };

      if (functionMap[funcName]) {
        return functionMap[funcName](args);
      }

      return `this.${funcName}(${args.join(', ')})`;
    }

    return funcCall;
  }

  /**
   * 解析参数列表
   */
  private parseArgs(argsStr: string, context: ParseContext): string[] {
    return argsStr.split(',').map((arg) => {
      const trimmed = arg.trim();
      if (trimmed.includes('${')) {
        return this.parseExpr(trimmed, context);
      }
      return trimmed;
    });
  }
}
