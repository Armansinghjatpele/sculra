// ==============================================================================
// Sculra Deterministic Safe Request Data Generator (worker/src/api-qa/generator.ts)
// ==============================================================================
// Generates bounded, deterministic test data for API parameters and request bodies.
// NEVER generates real credentials, personal information, payment details, or secrets.

import { ApiParameter, ApiRequestBodySchema } from './types';

export class ApiRequestDataGenerator {
  /**
   * Generates safe query parameters based on parameter schema or deterministic defaults.
   */
  static generateQueryParams(parameters: ApiParameter[] = []): Record<string, string> {
    const queryParams: Record<string, string> = {};

    for (const param of parameters) {
      if (param.in !== 'query') continue;
      // If parameter is required or has default/example, populate it
      const value = this.generatePrimitiveValue(param.schema, param.example ?? param.defaultValue);
      if (value !== undefined) {
        queryParams[param.name] = String(value);
      }
    }

    return queryParams;
  }

  /**
   * Resolves path parameters (e.g. /api/projects/{id} -> /api/projects/1).
   */
  static resolvePathParams(
    path: string,
    parameters: ApiParameter[] = []
  ): { resolvedPath: string; pathParams: Record<string, string> } {
    const pathParams: Record<string, string> = {};
    let resolvedPath = path;

    // 1. Check path parameters in parameter list
    for (const param of parameters) {
      if (param.in === 'path') {
        const val = this.generatePrimitiveValue(param.schema, param.example ?? param.defaultValue) ?? '1';
        pathParams[param.name] = String(val);
        resolvedPath = resolvedPath.replace(new RegExp(`\\{${param.name}\\}`, 'g'), String(val));
      }
    }

    // 2. Replace any remaining placeholders (e.g. {id})
    resolvedPath = resolvedPath.replace(/\{id\}/g, () => {
      pathParams['id'] = '1';
      return '1';
    });

    resolvedPath = resolvedPath.replace(/\{[a-zA-Z0-9_-]+\}/g, (match) => {
      const key = match.slice(1, -1);
      pathParams[key] = 'sculra-test';
      return 'sculra-test';
    });

    return { resolvedPath, pathParams };
  }

  /**
   * Generates deterministic safe request body payload.
   */
  static generateRequestBody(bodySchema?: ApiRequestBodySchema): any {
    if (!bodySchema || !bodySchema.schema) return undefined;
    return this.generateFromSchema(bodySchema.schema, 0);
  }

  /**
   * Recursively builds sample payload according to JSON schema.
   */
  private static generateFromSchema(schema: any, depth: number): any {
    if (!schema || typeof schema !== 'object' || depth > 6) {
      return 'sculra-test';
    }

    if (schema.example !== undefined) return schema.example;
    if (schema.default !== undefined) return schema.default;
    if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

    const type = schema.type || (schema.properties ? 'object' : 'string');

    switch (type) {
      case 'string':
        if (schema.format === 'email') return 'test@sculra.internal';
        if (schema.format === 'date-time') return '2026-01-01T00:00:00Z';
        if (schema.format === 'uuid') return '00000000-0000-0000-0000-000000000001';
        return 'sculra-test';

      case 'integer':
        return schema.minimum !== undefined ? schema.minimum : 1;

      case 'number':
        return schema.minimum !== undefined ? schema.minimum : 1.0;

      case 'boolean':
        return false;

      case 'array':
        return [this.generateFromSchema(schema.items || { type: 'string' }, depth + 1)];

      case 'object': {
        const obj: Record<string, any> = {};
        const props = schema.properties || {};
        const required = Array.isArray(schema.required) ? schema.required : Object.keys(props);

        for (const key of required) {
          if (props[key]) {
            obj[key] = this.generateFromSchema(props[key], depth + 1);
          } else {
            obj[key] = 'sculra-test';
          }
        }
        return obj;
      }

      default:
        return 'sculra-test';
    }
  }

  /**
   * Generates primitive values with boundary safety.
   */
  private static generatePrimitiveValue(schema: any, example?: any): any {
    if (example !== undefined) return example;
    if (!schema) return 'sculra-test';
    if (Array.isArray(schema.enum) && schema.enum.length > 0) return schema.enum[0];

    const type = schema.type || 'string';
    if (type === 'integer') return schema.minimum !== undefined ? schema.minimum : 1;
    if (type === 'number') return schema.minimum !== undefined ? schema.minimum : 1.0;
    if (type === 'boolean') return false;
    return 'sculra-test';
  }
}
