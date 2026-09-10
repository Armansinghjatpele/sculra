// ==============================================================================
// Sculra Bounded OpenAPI 3.x Parser (worker/src/api-qa/openapi.ts)
// ==============================================================================
// Deterministic, SSRF-protected parser for OpenAPI 3.x specifications with bounded
// document size, recursion depth, and endpoint counts.

import {
  ApiEndpoint,
  ApiHttpMethod,
  ApiParameter,
  ApiRequestBodySchema,
  OpenApiDocumentSummary,
  ApiExecutionLimits,
  DEFAULT_API_EXECUTION_LIMITS,
  SAFE_AUTO_EXECUTE_METHODS,
} from './types';
import { validateTargetUrl } from '../security/ssrf';
import { normalizeHttpMethod, normalizeEndpointPath, generateEndpointId } from './normalizer';
import { CancellationToken } from '../types';

export class OpenApiParser {
  private limits: ApiExecutionLimits;

  constructor(limits: Partial<ApiExecutionLimits> = {}) {
    this.limits = { ...DEFAULT_API_EXECUTION_LIMITS, ...limits };
  }

  /**
   * Fetches and parses an OpenAPI specification document from a URL with SSRF protection.
   */
  async parseFromUrl(
    openApiUrl: string,
    options: { allowLocalhost?: boolean; cancellationToken?: CancellationToken } = {}
  ): Promise<OpenApiDocumentSummary> {
    const parseErrors: string[] = [];

    // 1. SSRF Validation on initial URL
    const urlValidation = validateTargetUrl(openApiUrl, {
      allowLocalhost: options.allowLocalhost,
    });

    if (!urlValidation.valid) {
      return {
        endpointsCount: 0,
        endpoints: [],
        parseErrors: [`SSRF Security Violation: ${urlValidation.error}`],
      };
    }

    const safeUrl = urlValidation.sanitizedUrl || openApiUrl;

    // 2. Bounded Fetch with redirect revalidation
    try {
      if (options.cancellationToken?.isCancelled) {
        return { endpointsCount: 0, endpoints: [], parseErrors: ['Parsing cancelled'] };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.limits.requestTimeoutMs);

      const response = await fetch(safeUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json, application/yaml, text/yaml, */*',
          'User-Agent': 'Sculra-Autonomous-QA-Engine/1.0',
        },
        redirect: 'manual', // Manually handle redirects to enforce SSRF revalidation
      });

      clearTimeout(timeoutId);

      // Handle redirect
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          return {
            endpointsCount: 0,
            endpoints: [],
            parseErrors: [`Redirect HTTP ${response.status} missing Location header`],
          };
        }

        const resolvedRedirect = new URL(location, safeUrl).toString();
        const redirectValidation = validateTargetUrl(resolvedRedirect, {
          allowLocalhost: options.allowLocalhost,
        });

        if (!redirectValidation.valid) {
          return {
            endpointsCount: 0,
            endpoints: [],
            parseErrors: [`Redirect target SSRF violation: ${redirectValidation.error}`],
          };
        }

        return this.parseFromUrl(resolvedRedirect, options);
      }

      if (!response.ok) {
        return {
          endpointsCount: 0,
          endpoints: [],
          parseErrors: [`HTTP ${response.status} ${response.statusText} fetching OpenAPI document`],
        };
      }

      // Check Content-Length header if present
      const contentLengthHeader = response.headers.get('content-length');
      if (contentLengthHeader && parseInt(contentLengthHeader, 10) > this.limits.maxOpenApiBytes) {
        return {
          endpointsCount: 0,
          endpoints: [],
          parseErrors: [
            `OpenAPI document exceeds size limit (${contentLengthHeader} > ${this.limits.maxOpenApiBytes} bytes)`,
          ],
        };
      }

      const text = await response.text();
      if (text.length > this.limits.maxOpenApiBytes) {
        return {
          endpointsCount: 0,
          endpoints: [],
          parseErrors: [
            `OpenAPI document content exceeds limit (${text.length} > ${this.limits.maxOpenApiBytes} bytes)`,
          ],
        };
      }

      return this.parseFromString(text, safeUrl);
    } catch (err: any) {
      return {
        endpointsCount: 0,
        endpoints: [],
        parseErrors: [`Failed to fetch OpenAPI document: ${err.message || String(err)}`],
      };
    }
  }

  /**
   * Parses OpenAPI JSON string into strongly typed endpoint models with schema depth bounding.
   */
  parseFromString(rawContent: string, sourceUrl?: string): OpenApiDocumentSummary {
    const parseErrors: string[] = [];

    if (!rawContent || !rawContent.trim()) {
      return { endpointsCount: 0, endpoints: [], parseErrors: ['OpenAPI document content is empty'] };
    }

    let doc: any;
    try {
      doc = JSON.parse(rawContent);
    } catch (jsonErr: any) {
      return {
        endpointsCount: 0,
        endpoints: [],
        parseErrors: [`Malformed OpenAPI JSON document: ${jsonErr.message}`],
      };
    }

    if (typeof doc !== 'object' || doc === null) {
      return {
        endpointsCount: 0,
        endpoints: [],
        parseErrors: ['OpenAPI document root must be a valid JSON object'],
      };
    }

    // Validate OpenAPI version (support 3.x and 2.x/Swagger basic structures)
    const version = doc.openapi || doc.swagger;
    if (!version) {
      parseErrors.push('Missing "openapi" or "swagger" version declaration in document root.');
    }

    const title = doc.info?.title || 'OpenAPI Specification';
    const endpoints: ApiEndpoint[] = [];
    const paths = doc.paths;

    if (!paths || typeof paths !== 'object') {
      return {
        title,
        version: String(version || 'unknown'),
        endpointsCount: 0,
        endpoints: [],
        parseErrors: parseErrors.concat(['No "paths" object defined in OpenAPI document']),
      };
    }

    const now = new Date().toISOString();
    const httpMethods: ApiHttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

    for (const [pathKey, pathItem] of Object.entries(paths)) {
      if (endpoints.length >= this.limits.maxOpenApiEndpoints) {
        parseErrors.push(`Reached maximum endpoint capacity (${this.limits.maxOpenApiEndpoints})`);
        break;
      }

      if (!pathItem || typeof pathItem !== 'object') continue;

      const pathLevelParams = Array.isArray((pathItem as any).parameters)
        ? (pathItem as any).parameters
        : [];

      for (const method of httpMethods) {
        const lowerMethod = method.toLowerCase();
        const operation: any = (pathItem as any)[lowerMethod];
        if (!operation || typeof operation !== 'object') continue;

        const normMethod = normalizeHttpMethod(method);
        const normPath = normalizeEndpointPath(pathKey);
        const endpointId = generateEndpointId(normMethod, normPath);

        // Parameters extraction (combining path-level and operation-level parameters)
        const opParams = Array.isArray(operation.parameters) ? operation.parameters : [];
        const allParams = [...pathLevelParams, ...opParams];
        const extractedParams: ApiParameter[] = [];

        for (const p of allParams) {
          if (!p || typeof p !== 'object' || !p.name) continue;
          extractedParams.push({
            name: String(p.name),
            in: p.in === 'path' || p.in === 'header' || p.in === 'cookie' ? p.in : 'query',
            required: !!p.required || p.in === 'path',
            type: p.schema?.type || p.type || 'string',
            schema: this.sanitizeSchema(p.schema, 0),
            example: p.example || p.schema?.example || p.default || p.schema?.default,
            description: p.description ? String(p.description).substring(0, 200) : undefined,
          });
        }

        // Request body extraction
        let requestBody: ApiRequestBodySchema | undefined;
        if (operation.requestBody && typeof operation.requestBody === 'object') {
          const content: any = operation.requestBody.content;
          if (content && typeof content === 'object') {
            const firstContentType = Object.keys(content)[0] || 'application/json';
            const schemaObj = content[firstContentType]?.schema;
            requestBody = {
              contentType: firstContentType,
              schema: this.sanitizeSchema(schemaObj, 0),
              example: content[firstContentType]?.example,
              required: !!operation.requestBody.required,
            };
          }
        }

        const isSafeAuto = SAFE_AUTO_EXECUTE_METHODS.has(normMethod);

        endpoints.push({
          id: endpointId,
          method: normMethod,
          path: normPath,
          url: sourceUrl ? new URL(normPath, sourceUrl).toString() : normPath,
          source: 'OPENAPI',
          firstSeen: now,
          lastSeen: now,
          operationId: operation.operationId ? String(operation.operationId) : undefined,
          summary: operation.summary ? String(operation.summary).substring(0, 200) : undefined,
          description: operation.description ? String(operation.description).substring(0, 500) : undefined,
          parameters: extractedParams,
          requestBody,
          confidence: 1.0,
          requiresExplicitSafeConfig: !isSafeAuto,
          tags: Array.isArray(operation.tags) ? operation.tags.map(String) : [],
        });
      }
    }

    return {
      title,
      version: String(version || '3.0.0'),
      endpointsCount: endpoints.length,
      endpoints,
      parseErrors: parseErrors.length > 0 ? parseErrors : undefined,
    };
  }

  /**
   * Recursively sanitizes and bounds schema structures up to maxSchemaDepth.
   */
  private sanitizeSchema(schema: any, depth: number): any {
    if (!schema || typeof schema !== 'object' || depth > this.limits.maxSchemaDepth) {
      return undefined;
    }

    const clean: Record<string, any> = {};

    if (schema.type) clean.type = String(schema.type);
    if (schema.format) clean.format = String(schema.format);
    if (schema.enum && Array.isArray(schema.enum)) clean.enum = schema.enum.slice(0, 20);
    if (schema.required && Array.isArray(schema.required)) clean.required = schema.required.slice(0, 50);
    if (schema.minimum !== undefined) clean.minimum = schema.minimum;
    if (schema.maximum !== undefined) clean.maximum = schema.maximum;
    if (schema.minLength !== undefined) clean.minLength = schema.minLength;
    if (schema.maxLength !== undefined) clean.maxLength = schema.maxLength;
    if (schema.default !== undefined) clean.default = schema.default;
    if (schema.example !== undefined) clean.example = schema.example;

    if (schema.properties && typeof schema.properties === 'object' && depth < this.limits.maxSchemaDepth) {
      clean.properties = {};
      for (const [propKey, propVal] of Object.entries(schema.properties)) {
        clean.properties[propKey] = this.sanitizeSchema(propVal, depth + 1);
      }
    }

    if (schema.items && typeof schema.items === 'object' && depth < this.limits.maxSchemaDepth) {
      clean.items = this.sanitizeSchema(schema.items, depth + 1);
    }

    return clean;
  }
}
