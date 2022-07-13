const { Cluster } = require('puppeteer-cluster');
const { program } = require('commander');

program
  .option('-t, --target <url>')
  .option('-i, --identifiers [identifiers...]')
  .option('-c, --credentials [credentials...]');

program.parse();
const { target, identifiers, credentials } = program.opts();

let visitedUrls = [];

const authInteractions = [
	{
		selector: '#content > div:nth-child(1) > form > table > tbody > tr:nth-child(1) > td:nth-child(2) > input[type=text]',
		action: 'type',
		input: credentials[0],
	},
	{
		selector: '#content > div:nth-child(1) > form > table > tbody > tr:nth-child(2) > td:nth-child(2) > input[type=password]',
		action: 'type',
		input: credentials[1],
	},
	{
		selector: '#content > div:nth-child(1) > form > table > tbody > tr:nth-child(3) > td > input[type=submit]',
		action: 'click',
	},
];

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

			if (resourceType == "document") {
				visitedUrls.push({ url: responseUrl });
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

	const detectXSLeaks = async ({ page, data }) => {
		const { url } = data;

		await page.goto(url, { waitUntil: 'domcontentloaded' });
 		const response = await page.waitForResponse(response => {
			return response;
		});
	
		let xsleaks = await page.evaluate(() => {
			return {
				iframes: window.length,
				navigations: history.length,
			}
		});

		console.log({status: response.status(), ...xsleaks});
	}

	const authenticate = async ({ page, data }) => {
		const { url } = data;

		await page.goto(url);
		let typed = authInteractions.filter((interaction) =>
			interaction.action == "type" 
		);

		for await (const { selector, input } of typed) {
			await page.type(selector, input);
		}

		await Promise.all([
			...(authInteractions.filter((interaction) => interaction.action == 'click')).map(({selector}) => page.click(selector)),
			page.waitForNavigation({ waitUntil: 'networkidle0' }),
  		]);
	};

	if (credentials) {
		await cluster.execute({ url: target }, authenticate);
	}

	cluster.queue({ url: target }, deepCrawl);
	await cluster.idle();

	let filteredUrls = [];
	if (identifiers) {
		for (let { url } of visitedUrls) {	
			for (let identifier of identifiers) {
				if (url.includes(identifier)) {
					filteredUrls.push({url});
					break;
				}
			}
		}
	} else {
		filteredUrls.push(...visitedUrls);
	}

	filteredUrls.forEach(({ url }) =>
		cluster.queue({ url }, detectXSLeaks)
	);

	await cluster.idle();
	await cluster.close();
})();