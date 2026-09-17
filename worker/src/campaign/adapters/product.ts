// ==============================================================================
// Sculra Product Understanding Adapter (worker/src/campaign/adapters/product.ts)
// ==============================================================================

import { CampaignTask, CampaignTaskResult } from '../types';
import { ProductModelBuilder, ProductModel } from '../../product';
import { ApplicationMap } from '../../types';

export class ProductAdapter {
  static async execute(
    task: CampaignTask,
    targetUrl: string,
    appMap?: ApplicationMap,
    testRunId: string = 'campaign-run'
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const productModel: ProductModel = await ProductModelBuilder.build({
        testRunId,
        targetUrl,
        applicationMap: appMap,
      });

      return {
        taskId: task.id,
        status: 'PASSED',
        target: task.target,
        domain: 'PRODUCT',
        findings: [],
        evidence: [
          {
            type: 'product_model',
            title: `Product Model: ${productModel.features?.length || 0} features, ${productModel.workflows?.length || 0} workflows`,
            url: targetUrl,
            metadata: { productModel },
          },
        ],
        observations: [],
        durationMs: Date.now() - startTime,
        coverage: {
          pagesEvaluated: productModel.features?.length || 0,
        },
        metadata: { productModel },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'PRODUCT',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Product model builder failed',
      };
    }
  }
}
