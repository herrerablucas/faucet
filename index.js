const { Cluster } = require('puppeteer-cluster');

let visitedUrls = [];

(async () => {
	const cluster = await Cluster.launch({
		concurrency: Cluster.CONCURRENCY_PAGE,
		maxConcurrency: 2,
		puppeteerOptions: {
			headless: false
		}
	});

	const getUrls = async ({page, data}) => {
		const { url } = data;
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		
		console.log(`Extracting URLs from "${url}"...`);
		let urls = await page.evaluate(() => {
        	return [...document.querySelectorAll('a')]
                .map(({ href }) => ({ url: href }));
        });

		visitedUrls.push(...urls);
		return urls;
	}

	const deepCrawl = async ({ page, data }) => {
        const { url } = data;
		
		await page.goto(url, { waitUntil: 'domcontentloaded' });
		console.log(`Deep crawling "${url}"...`);

		const urls = await cluster.execute({ url }, getUrls);
		urls.forEach(({ url, name }, i) => cluster.queue({ url }, getUrls));
    };

	cluster.queue({ url: 'https://example.org'}, deepCrawl);

	await cluster.idle();
	await cluster.close();
	
})();