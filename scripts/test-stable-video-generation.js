const { fal } = require('@fal-ai/client');
require('dotenv').config();

(async () => {
  try {
    const apiKey = process.env.FAL_API_TOKEN;
    if (!apiKey) {
      console.error('❌  FAL_API_TOKEN environment variable is missing.');
      process.exit(1);
    }

    // Configure SDK
    fal.config({ credentials: apiKey });

    const model = 'fal-ai/stable-video/text-to-video';
    const generationParams = {
      prompt: 'A quick demo clip of a sunset over the ocean',
    };

    console.log('📡 Submitting request to', model);
    const { request_id } = await fal.queue.submit(model, generationParams);
    console.log('🆔  Request ID:', request_id);

    let status = 'IN_QUEUE';
    while (status !== 'COMPLETED') {
      const statusResp = await fal.queue.status(model, { request_id });
      status = statusResp.status;
      process.stdout.write(`⏱️  Status: ${status}\r`);
      if (status !== 'COMPLETED') {
        await new Promise((res) => setTimeout(res, 3000));
      }
    }
    console.log('\n✅ Generation completed. Fetching result...');

    const result = await fal.queue.result(model, { request_id });
    console.dir(result, { depth: null });

    if (result.metrics) {
      console.log('\n💰 Metrics:', result.metrics);
    } else {
      console.warn('\n⚠️ No metrics returned in result to infer cost.');
    }
  } catch (err) {
    console.error('❌ Error during generation:', err);
  }
})(); 