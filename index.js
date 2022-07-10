const { Cluster } = require('puppeteer-cluster');
const { program } = require('commander');

program
  .option('-t, --target <url>');
program.parse();
const { target } = program.opts();

let visitedUrls = [];

(async () => {
	const cluster = await Cluster.launch({
		concurrency: Cluster.CONCURRENCY_PAGE,
		maxConcurrency: 5,
		puppeteerOptions: {
			headless: false
		}
	});

	const getUrls = async ({page, data}) => {
		const { url } = data;
				
		console.log(`Extracting URLs from "${url}"...`);

		await page.setRequestInterception(true);
		page.on('request', (request) => {
			const allowlist = ['document', 'script', 'xhr', 'fetch'];
			if (!allowlist.includes(request.resourceType())) {
				return request.abort();
			}
			request.continue();
		})

		page.on('response', async (response) => {
			let resourceType = response.request().resourceType();
			let responseUrl = response.url();

			if (responseType == "document") {
				urls.push(responseUrl);
			}
		})

		await page.goto(url, { waitUntil: 'domcontentloaded' });

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
		urls.forEach(({ url }, i) => cluster.queue({ url }, getUrls));
    };

	cluster.queue({ url: target }, deepCrawl);

	await cluster.idle();
	await cluster.close();
	
})();