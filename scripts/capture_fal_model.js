// scripts/capture_fal_model.js
// Helper script: Capture before/after screenshots of a Fal model API page using Playwright.
// Usage: node scripts/capture_fal_model.js <model-slug> [output-dir]
// Example: node scripts/capture_fal_model.js fal-ai/fast-svd-lcm shots

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  try {
    const slug = process.argv[2];
    if (!slug) {
      console.error('Usage: node capture_fal_model.js <model-slug> [output-dir|playground|api] [output-dir]');
      process.exit(1);
    }

    // Determine mode and output directory
    let mode = 'playground';
    let outDir = 'shots';
    const arg3 = process.argv[3];
    const arg4 = process.argv[4];

    if (arg3 === 'api' || arg3 === 'playground') {
      mode = arg3;
      if (arg4) outDir = arg4;
    } else if (arg3) {
      // arg3 is output dir
      outDir = arg3;
    }

    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    // Sanitize filename replacing slashes with underscores
    const safeSlug = slug.replace(/[\/]/g, '_');
    const beforePath = path.join(outDir, `${safeSlug}_before.png`);
    const afterPath = path.join(outDir, `${safeSlug}_after.png`);

    const url = mode === 'api'
      ? `https://fal.ai/models/${slug}/api`
      : `https://fal.ai/models/${slug}`;
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

    console.log(`Opening ${mode.toUpperCase()} view → ${url} …`);
    await page.goto(url, { waitUntil: 'networkidle' });

    console.log(`Saving before screenshot → ${beforePath}`);
    await page.screenshot({ path: beforePath });

    // Try to open extra settings drawer – attempt several possible labels
    const labels = [
      'More',
      'Advanced filters',
      'Additional Settings',
      'Additional settings'
    ];

    let clicked = false;
    for (const label of labels) {
      const btn = await page.$(`text=${label}`);
      if (btn) {
        console.log(`Clicking “${label}”…`);
        await btn.click();
        await page.waitForTimeout(1000);
        // Make sure the entire drawer is rendered
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(300);
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      console.warn('⚠️  No settings drawer toggle found. Skipping click.');
    }

    console.log(`Saving after screenshot → ${afterPath}`);
    await page.screenshot({ path: afterPath, fullPage: true });

    await browser.close();
    console.log('Done!');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();